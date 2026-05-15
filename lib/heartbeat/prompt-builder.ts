import { getDb } from "@/db/index";
import { agents, approvals, memory, taskLogs, tasks } from "@/db/schema";
import {
  applyConductorInstructionPlaceholders,
  loadConductorOrchestrationSnapshot,
} from "@/lib/conductor/conductor-context";
import { and, desc, eq, inArray } from "drizzle-orm";

const CONTEXT_SEP = "\n\n--- CONTEXT ---\n\n";

function section(title: string, body: string): string {
  return `## ${title}\n\n${body.trim() ? body.trim() : "(empty)"}`;
}

export type HeartbeatPromptContext = {
  soul: string;
  heartbeatDoc: string;
  archetypeHeartbeatAddendum: string;
  memories: Array<{ content: string; updatedAt: Date }>;
  openTasks: Array<{ title: string; description: string }>;
  recentTaskLogs: Array<{ content: string; createdAt: Date }>;
  pendingApprovals: Array<{ id: string; artifactRef: unknown; comment: string | null }>;
};

/** Pure formatter — used by `buildHeartbeatPrompt` and unit tests. */
export function formatHeartbeatPrompt(c: HeartbeatPromptContext): string {
  const parts: string[] = [];
  parts.push(section("Soul", c.soul));
  parts.push(section("Heartbeat template", c.heartbeatDoc));
  if (c.archetypeHeartbeatAddendum.trim()) {
    parts.push(section("Archetype heartbeat addendum", c.archetypeHeartbeatAddendum));
  }
  parts.push(
    section(
      "Business memory (recent)",
      c.memories.length
        ? c.memories.map((m, i) => `### Memory ${i + 1}\n${m.content}`).join("\n\n")
        : "(none)",
    ),
  );
  parts.push(
    section(
      "Open tasks",
      c.openTasks.length
        ? c.openTasks.map((t) => `- **${t.title}**${t.description ? `: ${t.description}` : ""}`).join("\n")
        : "(none)",
    ),
  );
  parts.push(
    section(
      "Recent task logs",
      c.recentTaskLogs.length
        ? c.recentTaskLogs.map((l) => `- ${l.createdAt.toISOString()}: ${l.content}`).join("\n")
        : "(none)",
    ),
  );
  parts.push(
    section(
      "Pending approvals",
      c.pendingApprovals.length
        ? c.pendingApprovals
            .map((a) => `- **${a.id}**${a.comment ? ` (${a.comment})` : ""}\n${JSON.stringify(a.artifactRef)}`)
            .join("\n\n")
        : "(none)",
    ),
  );

  return parts.join(CONTEXT_SEP);
}

type HeartbeatPromptContextLoaded = HeartbeatPromptContext & {
  businessId: string;
  isPlatformDefault: boolean;
};

async function loadHeartbeatPromptContext(agentId: string): Promise<HeartbeatPromptContextLoaded> {
  const db = getDb();

  const agentRow = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    columns: { id: true, businessId: true, isPlatformDefault: true },
    with: {
      documents: true,
      archetype: { columns: { heartbeatAddendum: true } },
    },
  });

  if (!agentRow) {
    throw new Error("Agent not found");
  }

  const soul = agentRow.documents.find((d) => d.slug === "soul")?.content ?? "";
  const heartbeatDoc = agentRow.documents.find((d) => d.slug === "heartbeat")?.content ?? "";
  const archetypeHeartbeatAddendum = agentRow.archetype?.heartbeatAddendum?.trim() ?? "";

  const memRows = await db
    .select({ content: memory.content, updatedAt: memory.updatedAt })
    .from(memory)
    .where(eq(memory.businessId, agentRow.businessId))
    .orderBy(desc(memory.updatedAt))
    .limit(3);

  const openTasks = await db
    .select({ title: tasks.title, description: tasks.description })
    .from(tasks)
    .where(
      and(eq(tasks.agentId, agentId), inArray(tasks.status, ["backlog", "todo", "in_progress"])),
    );

  const agentTaskIds = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.agentId, agentId));

  let recentTaskLogs: Array<{ content: string; createdAt: Date }> = [];
  if (agentTaskIds.length > 0) {
    recentTaskLogs = await db
      .select({ content: taskLogs.content, createdAt: taskLogs.createdAt })
      .from(taskLogs)
      .where(
        inArray(
          taskLogs.taskId,
          agentTaskIds.map((r) => r.id),
        ),
      )
      .orderBy(desc(taskLogs.createdAt))
      .limit(5);
  }

  const platformDefault = agentRow.isPlatformDefault === true;

  const pendingApprovals = await db
    .select({
      id: approvals.id,
      artifactRef: approvals.artifactRef,
      comment: approvals.comment,
    })
    .from(approvals)
    .where(
      and(
        platformDefault
          ? eq(approvals.businessId, agentRow.businessId)
          : eq(approvals.agentId, agentId),
        eq(approvals.approvalStatus, "pending"),
      ),
    );

  return {
    soul,
    heartbeatDoc,
    archetypeHeartbeatAddendum,
    memories: memRows,
    openTasks,
    recentTaskLogs,
    pendingApprovals,
    businessId: agentRow.businessId,
    isPlatformDefault: platformDefault,
  };
}

/**
 * Compose the heartbeat markdown prompt: soul → heartbeat doc → archetype → memory → tasks → logs → approvals.
 */
export async function buildHeartbeatPrompt(agentId: string): Promise<string> {
  const loaded = await loadHeartbeatPromptContext(agentId);
  const { businessId, isPlatformDefault, ...ctx } = loaded;

  let soul = ctx.soul;
  if (isPlatformDefault) {
    const snap = await loadConductorOrchestrationSnapshot(businessId);
    soul = applyConductorInstructionPlaceholders(soul, snap);
  }

  return formatHeartbeatPrompt({ ...ctx, soul });
}
