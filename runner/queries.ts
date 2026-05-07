import { getDb } from "@/db/index";
import { resolveCursorApiKeyForBusiness } from "@/lib/settings/cursor-api-key";
import {
  agentDocuments,
  agentSkills,
  agents,
  businesses,
  memory,
  orchestrationEvents,
  skillFiles,
  skills,
  teams,
} from "@/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export async function resolveRunnerCursorApiKey(
  businessId: string | null,
): Promise<string | null> {
  if (businessId) {
    const fromWorkspace = await resolveCursorApiKeyForBusiness(businessId);
    if (fromWorkspace?.trim()) return fromWorkspace.trim();
  }
  const env = process.env.CURSOR_API_KEY?.trim();
  return env && env.length > 0 ? env : null;
}
export async function tryClaimOrchestrationEvent(eventId: string) {
  const db = getDb();
  const rows = await db
    .update(orchestrationEvents)
    .set({ status: "processing", updatedAt: new Date() })
    .where(and(eq(orchestrationEvents.id, eventId), eq(orchestrationEvents.status, "pending")))
    .returning();
  return rows[0] ?? null;
}

export async function listPendingOrchestrationEvents(limit = 5) {
  const db = getDb();
  return db
    .select({ id: orchestrationEvents.id })
    .from(orchestrationEvents)
    .where(eq(orchestrationEvents.status, "pending"))
    .orderBy(asc(orchestrationEvents.createdAt))
    .limit(limit);
}

export async function finishOrchestrationEvent(
  eventId: string,
  patch: {
    status: "succeeded" | "failed";
    payload: Record<string, unknown>;
  },
) {
  const db = getDb();
  await db
    .update(orchestrationEvents)
    .set({
      status: patch.status,
      payload: patch.payload,
      updatedAt: new Date(),
    })
    .where(eq(orchestrationEvents.id, eventId));
}

export async function getOrchestrationEventById(id: string) {
  const db = getDb();
  return db.query.orchestrationEvents.findFirst({
    where: eq(orchestrationEvents.id, id),
  });
}

export function pickAgentIdOverrideFromOrchestrationPayload(
  payload: Record<string, unknown>,
): string | undefined {
  if (typeof payload.agentId === "string" && payload.agentId.trim()) return payload.agentId.trim();
  const body = payload.body;
  if (body && typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    if (typeof b.agentId === "string" && b.agentId.trim()) return b.agentId.trim();
    if (typeof b.agent_id === "string" && b.agent_id.trim()) return b.agent_id.trim();
  }
  return undefined;
}

/** Resolves runner target agent before dispatch (lead agent fallback). */
export async function resolveAgentIdForEvent(eventId: string): Promise<string | null> {
  const evt = await getOrchestrationEventById(eventId);
  if (!evt?.businessId) return null;

  const raw = evt.payload;
  const payload =
    raw && typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const agentOverride = pickAgentIdOverrideFromOrchestrationPayload(payload);
  if (agentOverride) return agentOverride;
  return await getLeadAgentIdForBusiness(evt.businessId);
}

/** Returns `businesses.max_parallel_runs` — `null` means unlimited. */
export async function getBusinessMaxParallelRuns(
  businessId: string | null,
): Promise<number | null> {
  if (!businessId) return null;
  const db = getDb();
  const row = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { maxParallelRuns: true },
  });
  const n = row?.maxParallelRuns;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export async function getBusinessIntegrationBranch(businessId: string): Promise<string | null> {
  const db = getDb();
  const row = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { integrationBranch: true },
  });
  const b = row?.integrationBranch?.trim();
  return b && b.length > 0 ? b : null;
}

/** Reserved for PR-branch linkage (S7+). Returns `undefined` in v1. */
export async function getTaskPrBranch(_taskId: string): Promise<string | undefined> {
  return undefined;
}

export async function getLeadAgentIdForBusiness(businessId: string): Promise<string | null> {
  const db = getDb();
  const team = await db.query.teams.findFirst({
    where: eq(teams.businessId, businessId),
    columns: { leadAgentId: true },
    orderBy: [asc(teams.createdAt)],
  });
  return team?.leadAgentId ?? null;
}

export async function getBusinessLocalPath(businessId: string): Promise<string | null> {
  const db = getDb();
  const row = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { localPath: true },
  });
  const p = row?.localPath?.trim();
  return p && p.length > 0 ? p : null;
}

export async function requireBusinessMemoryExists(businessId: string): Promise<boolean> {
  const db = getDb();
  const row = await db.query.memory.findFirst({
    where: and(eq(memory.businessId, businessId), eq(memory.scope, "business")),
    columns: { id: true },
  });
  return row != null;
}

export async function getLatestBusinessMemoryContent(businessId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.query.memory.findMany({
    where: and(eq(memory.businessId, businessId), eq(memory.scope, "business")),
    orderBy: [desc(memory.updatedAt)],
    limit: 10,
    columns: { content: true },
  });
  if (rows.length === 0) return null;
  return rows.map((r) => r.content).join("\n\n---\n\n");
}

export async function loadAgentForRun(agentId: string) {
  const db = getDb();
  return db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    columns: {
      id: true,
      businessId: true,
      name: true,
      systemRoleId: true,
      role: true,
    },
    with: {
      systemRole: {
        columns: {
          slug: true,
          baseSystemPrompt: true,
          includeBusinessContext: true,
          requiresGitWorkspace: true,
        },
      },
      documents: {
        where: eq(agentDocuments.slug, "soul"),
        columns: { content: true },
      },
    },
  });
}

/** SKILL.md excerpts for runner context. */
export async function loadAgentSkillsContext(agentId: string): Promise<string> {
  const db = getDb();
  const links = await db
    .select({ skillId: agentSkills.skillId })
    .from(agentSkills)
    .where(eq(agentSkills.agentId, agentId));

  const skillIds = links.map((l) => l.skillId);
  if (skillIds.length === 0) return "";

  const files = await db
    .select({
      skillName: skills.name,
      path: skillFiles.path,
      content: skillFiles.content,
    })
    .from(skillFiles)
    .innerJoin(skills, eq(skills.id, skillFiles.skillId))
    .where(and(inArray(skillFiles.skillId, skillIds), eq(skillFiles.path, "SKILL.md")));

  return files
    .map((f) => `## Skill: ${f.skillName}\n\n${f.content.slice(0, 8000)}`)
    .join("\n\n---\n\n");
}
