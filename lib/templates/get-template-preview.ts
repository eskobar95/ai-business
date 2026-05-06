import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { verifyAndParseBundle } from "@/lib/templates/bundle-verify";
import type { BundlePayload } from "@/lib/templates/zod-schemas";

export type TemplatePreviewTeam = {
  slug: string;
  displayName: string;
  stream: string;
};

export type TemplatePreviewAgent = {
  slug: string;
  name: string;
  role: string;
  tier: number;
  teamSlug: string;
};

export type TemplatePreview = {
  teams: TemplatePreviewTeam[];
  agents: TemplatePreviewAgent[];
  edgeCount: number;
  gateKinds: Array<{ slug: string; label: string }>;
  templateVersion: string;
};

/** Mirrors enterprise v3 `teams.json` slugs → Product / Build stream labels. */
function teamSlugToStream(teamSlug: string): string {
  if (teamSlug === "product_team") return "Product";
  if (teamSlug === "engineering_team") return "Build";
  return teamSlug;
}

export function getDefaultEnterpriseBundlePath(): string {
  return resolve(process.cwd(), "dist", "conduro.enterprise.3.0.0.bundle.json");
}

export function buildTemplatePreview(bundle: BundlePayload): TemplatePreview {
  return {
    teams: bundle.shards.teams.map((t) => ({
      slug: t.team_slug,
      displayName: t.display_name,
      stream: teamSlugToStream(t.team_slug),
    })),
    agents: bundle.shards.agents.map((a) => ({
      slug: a.agent_slug,
      name: a.display_name,
      role: a.role_summary,
      tier: a.tier,
      teamSlug: a.team_slug,
    })),
    edgeCount: bundle.shards.communication_policy.edges.length,
    gateKinds: bundle.shards.gates.gate_kinds.map((g) => ({
      slug: g.slug,
      label: g.label,
    })),
    templateVersion: bundle.manifest.template_version,
  };
}

/** Reads built bundle from disk (after `npm run templates:build`). */
export function getTemplatePreview(bundlePath = getDefaultEnterpriseBundlePath()): TemplatePreview {
  const raw = JSON.parse(readFileSync(bundlePath, "utf8"));
  const bundle = verifyAndParseBundle(raw);
  return buildTemplatePreview(bundle);
}
