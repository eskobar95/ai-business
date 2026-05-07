import { getDb } from "@/db/index";
import { agentDocuments, agents } from "@/db/schema";
import { eq } from "drizzle-orm";

import { getLatestBusinessMemoryContent } from "./queries";

export interface LeadHeartbeatPromptInput {
  agentId: string;
  businessId: string;
  backlogTasks: Array<{
    id: string;
    title: string;
    description: string | null;
    dependencyTaskId: string | null;
    githubPrNumber: number | null;
    prMergedToIntegration: boolean;
    agentId: string | null;
  }>;
}

export async function buildLeadHeartbeatPrompt(input: LeadHeartbeatPromptInput): Promise<string> {
  const db = getDb();

  const [agentRow, memory] = await Promise.all([
    db.query.agents.findFirst({
      where: eq(agents.id, input.agentId),
      columns: { name: true, role: true },
      with: {
        documents: {
          where: eq(agentDocuments.slug, "soul"),
          limit: 1,
          orderBy: (d, { desc: ddesc }) => [ddesc(d.updatedAt)],
          columns: { content: true },
        },
      },
    }),
    getLatestBusinessMemoryContent(input.businessId),
  ]);

  const soul = agentRow?.documents?.[0]?.content ?? "(No soul document found)";
  const agentName = agentRow?.name ?? "Lead Agent";

  const taskLines = input.backlogTasks
    .map((t) => {
      const gates: string[] = [];
      if (t.dependencyTaskId) gates.push(`depends on task ${t.dependencyTaskId}`);
      if (t.githubPrNumber && !t.prMergedToIntegration) {
        gates.push(`PR #${t.githubPrNumber} not merged`);
      }
      const gateStr = gates.length > 0 ? ` [BLOCKED: ${gates.join("; ")}]` : " [READY]";
      const assignee = t.agentId ? `assigned:${t.agentId.slice(0, 8)}` : "unassigned";
      return `- id:${t.id} | ${t.title}${gateStr} | ${assignee}`;
    })
    .join("\n");

  const sections = [
    `# ${agentName} — Lead Heartbeat`,
    "",
    "## Your role",
    soul,
    "",
    "## Business context",
    memory ?? "(No business memory found)",
    "",
    "## Current backlog (candidates for promotion to todo)",
    taskLines || "(No backlog tasks found)",
    "",
    "## Your task",
    "Review the backlog above. Identify which tasks are READY (not blocked) and should be started now.",
    "Consider task dependencies and agent capacity.",
    "Return a JSON block with the task IDs you recommend promoting to 'todo' status.",
    "",
    "IMPORTANT: Only return tasks marked [READY]. Never return tasks marked [BLOCKED].",
    "Return at most the number specified by your heartbeat cap (the system enforces it, but be conservative).",
    "",
    "Respond with ONLY this JSON block and a brief rationale:",
    "```json",
    '{ "promote": ["task-id-1", "task-id-2"] }',
    "```",
  ];

  return sections.join("\n");
}
