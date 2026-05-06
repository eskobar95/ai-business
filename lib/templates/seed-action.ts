"use server";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getDb } from "@/db/index";
import { agents, businesses, communicationEdges, gateKinds, teams } from "@/db/schema";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { requireSessionUserId } from "@/lib/roster/session";
import { verifyAndParseBundle } from "@/lib/templates/bundle-verify";
import {
  seedEnterpriseTemplate,
  type SeedEnterpriseTemplateResult,
} from "@/lib/templates/seed-enterprise-template";
import { TemplateSeedError } from "@/lib/templates/template-errors";
import { count, eq } from "drizzle-orm";

export type SeedEnterpriseTemplateActionSuccess = {
  ok: true;
  alreadySeeded: boolean;
} & SeedEnterpriseTemplateResult;

export type SeedEnterpriseTemplateActionResult =
  | SeedEnterpriseTemplateActionSuccess
  | { ok: false; error: string };

const DEFAULT_BUNDLE_REL = ["dist", "conduro.enterprise.3.0.0.bundle.json"] as const;

async function countSeededRows(businessId: string): Promise<SeedEnterpriseTemplateResult> {
  const db = getDb();
  const [teamRow] = await db
    .select({ n: count() })
    .from(teams)
    .where(eq(teams.businessId, businessId));
  const [agentRow] = await db
    .select({ n: count() })
    .from(agents)
    .where(eq(agents.businessId, businessId));
  const [edgeRow] = await db
    .select({ n: count() })
    .from(communicationEdges)
    .where(eq(communicationEdges.businessId, businessId));
  const [gateRow] = await db
    .select({ n: count() })
    .from(gateKinds)
    .where(eq(gateKinds.businessId, businessId));
  return {
    teams: Number(teamRow?.n ?? 0),
    agents: Number(agentRow?.n ?? 0),
    edges: Number(edgeRow?.n ?? 0),
    gates: Number(gateRow?.n ?? 0),
  };
}

/**
 * One-click enterprise template seed from dashboard.
 * Bundle must exist at `dist/conduro.enterprise.3.0.0.bundle.json` (`npm run templates:build`).
 *
 * TODO(stream-a): Full instruction bodies (AGENTS.md, SOUL.md, HEARTBEAT.md, TOOLS.md) in the
 * bundle once Stream A merges; `seedEnterpriseTemplate` already upserts `agent_documents` from the bundle.
 */
export async function seedEnterpriseTemplateAction(
  businessId: string,
): Promise<SeedEnterpriseTemplateActionResult> {
  try {
    const userId = await requireSessionUserId();
    await assertUserBusinessAccess(userId, businessId);

    const db = getDb();
    const row = await db
      .select({ templateSeeded: businesses.templateSeeded })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (row.length === 0) {
      return { ok: false, error: "Business not found." };
    }

    if (row[0]!.templateSeeded) {
      const counts = await countSeededRows(businessId);
      return { ok: true, alreadySeeded: true, ...counts };
    }

    const bundlePath = resolve(process.cwd(), ...DEFAULT_BUNDLE_REL);
    const raw = JSON.parse(readFileSync(bundlePath, "utf8"));
    const bundle = verifyAndParseBundle(raw);

    const result = await seedEnterpriseTemplate(db, businessId, bundle);
    return { ok: true, alreadySeeded: false, ...result };
  } catch (e) {
    if (e instanceof TemplateSeedError) {
      return { ok: false, error: e.message };
    }
    if (e instanceof Error) {
      if (e.message === "Unauthorized") {
        return { ok: false, error: "You must be signed in." };
      }
      if ("code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          ok: false,
          error:
            "Template bundle not found. Run `npm run templates:build` to generate dist/conduro.enterprise.3.0.0.bundle.json.",
        };
      }
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Seeding failed." };
  }
}
