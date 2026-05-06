/**
 * Idempotent upsert of platform `system_roles` rows with autonomous-flow behaviour flags.
 *
 * Env: loads `.env` then `.env.local` (aligned with `drizzle.config.ts` / archetype seed).
 * URL: prefers DATABASE_DIRECT_URL, then DATABASE_URL (valid postgres: URLs only).
 *
 * Run: `npm run db:seed-system-roles`
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { systemRoles } from "@/db/schema";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

function pickMigrateUrl(): string | null {
  const candidates = [
    process.env.DATABASE_DIRECT_URL?.trim(),
    process.env.DATABASE_URL?.trim(),
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  for (const raw of candidates) {
    try {
      const u = new URL(raw);
      if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") continue;
      return raw;
    } catch {
      /* try next */
    }
  }
  return null;
}

const ROLE_ROWS = [
  {
    slug: "engineer",
    name: "Engineer",
    description:
      "Implements technical work with git discipline; gate evaluation includes merge to integration branch.",
    baseSystemPrompt: "You are a software engineer executing tasks in-repo with tooling and gates.",
    requiresGitWorkspace: true,
    mayPromoteBacklogToTodo: false,
    requiresPrMergeGate: true,
    runsHeartbeat: false,
  },
  {
    slug: "developer",
    name: "Developer",
    description:
      "Hands-on contributor with git workspace; merge-to-integration gates apply before moving forward.",
    baseSystemPrompt: "You are a developer shipping code via PRs merged to the integration branch.",
    requiresGitWorkspace: true,
    mayPromoteBacklogToTodo: false,
    requiresPrMergeGate: true,
    runsHeartbeat: false,
  },
  {
    slug: "analyst",
    name: "Analyst",
    description: "Insight and synthesis without mandatory git checkout or PR merge gates.",
    baseSystemPrompt: "You analyze information and communicate findings clearly.",
    requiresGitWorkspace: false,
    mayPromoteBacklogToTodo: false,
    requiresPrMergeGate: false,
    runsHeartbeat: false,
  },
  {
    slug: "researcher",
    name: "Researcher",
    description: "Explores domains and summarizes options; no runner git workspace by default.",
    baseSystemPrompt: "You research topics rigorously and cite assumptions.",
    requiresGitWorkspace: false,
    mayPromoteBacklogToTodo: false,
    requiresPrMergeGate: false,
    runsHeartbeat: false,
  },
  {
    slug: "ux_designer",
    name: "UX Designer",
    description: "Design collaboration; no git-preflight or PR merge gate on task lifecycle.",
    baseSystemPrompt: "You focus on user experience, flows, and clear design rationale.",
    requiresGitWorkspace: false,
    mayPromoteBacklogToTodo: false,
    requiresPrMergeGate: false,
    runsHeartbeat: false,
  },
  {
    slug: "engineering_manager",
    name: "Engineering Manager",
    description: "May promote backlog work to todo; receives lead-style heartbeat orchestration.",
    baseSystemPrompt: "You coordinate engineering delivery, risk, and sequencing.",
    requiresGitWorkspace: false,
    mayPromoteBacklogToTodo: true,
    requiresPrMergeGate: false,
    runsHeartbeat: true,
  },
  {
    slug: "product_owner",
    name: "Product Owner",
    description: "Owns backlog prioritization; may promote items to todo; heartbeat-capable orchestration.",
    baseSystemPrompt: "You represent product outcomes, scope, and acceptance criteria.",
    requiresGitWorkspace: false,
    mayPromoteBacklogToTodo: true,
    requiresPrMergeGate: false,
    runsHeartbeat: true,
  },
  {
    slug: "lead",
    name: "Lead",
    description:
      "Tech lead combining git-backed execution with promotion rights and heartbeat orchestration.",
    baseSystemPrompt: "You lead the team: execution, sequencing, gates, and promotion within policy.",
    requiresGitWorkspace: true,
    mayPromoteBacklogToTodo: true,
    requiresPrMergeGate: true,
    runsHeartbeat: true,
  },
] as const;

async function main() {
  const url = pickMigrateUrl();
  if (!url) {
    console.error(
      "db:seed-system-roles: need a valid postgres:// URL in DATABASE_URL or DATABASE_DIRECT_URL.",
    );
    process.exit(1);
  }

  const pg = postgres(url, { max: 1 });
  const db = drizzle(pg);

  try {
    for (const row of ROLE_ROWS) {
      await db
        .insert(systemRoles)
        .values({
          slug: row.slug,
          name: row.name,
          description: row.description,
          baseSystemPrompt: row.baseSystemPrompt,
          requiresGitWorkspace: row.requiresGitWorkspace,
          mayPromoteBacklogToTodo: row.mayPromoteBacklogToTodo,
          requiresPrMergeGate: row.requiresPrMergeGate,
          runsHeartbeat: row.runsHeartbeat,
        })
        .onConflictDoUpdate({
          target: systemRoles.slug,
          set: {
            requiresGitWorkspace: row.requiresGitWorkspace,
            mayPromoteBacklogToTodo: row.mayPromoteBacklogToTodo,
            requiresPrMergeGate: row.requiresPrMergeGate,
            runsHeartbeat: row.runsHeartbeat,
          },
        });
    }
    console.log(`Upserted ${ROLE_ROWS.length} system role(s).`);
  } finally {
    await pg.end({ timeout: 10 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
