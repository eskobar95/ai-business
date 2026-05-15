"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db/index";
import { agents, approvals, memory, missions, sprints, tasks } from "@/db/schema";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { requireSessionUserId } from "@/lib/roster/session";

type PoSprintBriefArtifactRef = {
  sprintId?: unknown;
  missionId?: unknown;
  artifactType?: unknown;
};

type SimulatedEmTask = {
  title: string;
  description: string;
  agentSlug: string;
  priority: "high" | "medium" | "low";
  estimatedHours: number;
};

function parsePoSprintBriefIds(
  artifactRef: Record<string, unknown>,
): { sprintId: string; missionId: string } | null {
  const raw = artifactRef as PoSprintBriefArtifactRef;
  const sprintId = raw.sprintId;
  const missionId = raw.missionId;
  if (typeof sprintId !== "string" || typeof missionId !== "string") return null;
  if (!sprintId.trim() || !missionId.trim()) return null;
  return { sprintId: sprintId.trim(), missionId: missionId.trim() };
}

function normalizeRoleKey(role: string): string {
  return role.toLowerCase().trim().replace(/\s+/g, "_");
}

function agentMatchesSlug(agent: { slug: string | null; role: string }, targetSlug: string): boolean {
  const t = targetSlug.toLowerCase();
  const slug = (agent.slug ?? "").toLowerCase();
  if (slug === t) return true;
  const roleKey = normalizeRoleKey(agent.role);
  return roleKey === t || roleKey.includes(t);
}

function findEngineeringManagerAgent(
  roster: { id: string; slug: string | null; role: string }[],
): { id: string; slug: string | null; role: string } | null {
  for (const a of roster) {
    const slug = (a.slug ?? "").toLowerCase();
    const role = a.role.toLowerCase();
    if (
      slug === "engineering_manager" ||
      slug.includes("engineering_manager") ||
      role.includes("engineering manager")
    ) {
      return a;
    }
  }
  return null;
}

function pickAgentsForPromptContext(
  roster: { slug: string | null; role: string }[],
): string[] {
  const wanted = ["tech_lead", "software_engineer", "qa_engineer", "security_reviewer", "devops_engineer"];
  const lines: string[] = [];
  for (const slug of wanted) {
    const match = roster.find((a) => agentMatchesSlug(a, slug));
    lines.push(
      `- ${slug}: ${match ? `${match.slug ?? "(no slug)"} — ${match.role}` : "(not found on roster)"}`,
    );
  }
  return lines;
}

function buildSimulatedEmTasks(params: {
  missionName: string;
  sprintGoal: string;
  validationContract: string;
  preparedPromptContextChars: number;
}): SimulatedEmTask[] {
  const goalSnippet =
    params.sprintGoal.trim().length > 320
      ? `${params.sprintGoal.trim().slice(0, 320)}…`
      : params.sprintGoal.trim() || "(No sprint goal text yet.)";
  const vcSnippet =
    params.validationContract.trim().length > 280
      ? `${params.validationContract.trim().slice(0, 280)}…`
      : params.validationContract.trim() || "(No validation contract yet.)";

  const missionName = params.missionName.trim() || "Mission";

  const metaLine = `_Prepared EM prompt context (${params.preparedPromptContextChars} chars; MVP simulated decomposition)._`;

  return [
    {
      title: "Setup project structure and dependencies",
      description: [
        metaLine,
        "",
        `Prepare repository/workspace scaffolding aligned with the approved sprint brief.`,
        "",
        `**Sprint brief (excerpt)**`,
        goalSnippet,
        "",
        `**Validation contract (excerpt)**`,
        vcSnippet,
        "",
        `_Estimated effort: 4h (simulated)._`,
      ].join("\n"),
      agentSlug: "tech_lead",
      priority: "high",
      estimatedHours: 4,
    },
    {
      title: `Implement core feature: ${missionName}`,
      description: [
        `Deliver the primary implementation work for **${missionName}**, grounded in the sprint goal and validation contract.`,
        "",
        `**Sprint brief (excerpt)**`,
        goalSnippet,
        "",
        `**Validation contract (excerpt)**`,
        vcSnippet,
        "",
        `_Estimated effort: 8h (simulated)._`,
      ].join("\n"),
      agentSlug: "software_engineer",
      priority: "high",
      estimatedHours: 8,
    },
    {
      title: "Write unit and integration tests",
      description: [
        `Add automated tests that prove the sprint outcomes against the validation contract.`,
        "",
        `**Validation contract (excerpt)**`,
        vcSnippet,
        "",
        `_Estimated effort: 4h (simulated)._`,
      ].join("\n"),
      agentSlug: "qa_engineer",
      priority: "medium",
      estimatedHours: 4,
    },
    {
      title: "Security review and hardening",
      description: [
        `Review threat surface for the changes implied by the sprint brief and tighten defaults accordingly.`,
        "",
        `**Sprint brief (excerpt)**`,
        goalSnippet,
        "",
        `_Estimated effort: 3h (simulated)._`,
      ].join("\n"),
      agentSlug: "security_reviewer",
      priority: "medium",
      estimatedHours: 3,
    },
    {
      title: "CI/CD pipeline and deployment setup",
      description: [
        `Ensure builds/tests/deploy hooks support the engineering breakdown for **${missionName}**.`,
        "",
        `**Sprint brief (excerpt)**`,
        goalSnippet,
        "",
        `_Estimated effort: 4h (simulated)._`,
      ].join("\n"),
      agentSlug: "devops_engineer",
      priority: "low",
      estimatedHours: 4,
    },
  ];
}

export async function runEngineeringManagerDecomposition(
  businessId: string,
  approvalId: string,
): Promise<{ success: true; taskIds: string[] } | { success: false; error: string }> {
  try {
    const userId = await requireSessionUserId();
    await assertUserBusinessAccess(userId, businessId);

    const db = getDb();

    const approvalRow = await db.query.approvals.findFirst({
      where: eq(approvals.id, approvalId),
    });
    if (!approvalRow?.businessId || approvalRow.businessId !== businessId) {
      return { success: false, error: "Approval not found" };
    }

    if (approvalRow.approvalStatus !== "approved") {
      return { success: false, error: "Approval must be approved before decomposition" };
    }

    const ids = parsePoSprintBriefIds(approvalRow.artifactRef as Record<string, unknown>);
    if (!ids) {
      return { success: false, error: "Approval artifact is missing sprint/mission identifiers" };
    }

    const { sprintId, missionId } = ids;

    const sprintRow = await db.query.sprints.findFirst({
      where: eq(sprints.id, sprintId),
    });
    if (!sprintRow || sprintRow.missionId !== missionId) {
      return { success: false, error: "Sprint not found for this approval" };
    }

    const missionRow = await db.query.missions.findFirst({
      where: eq(missions.id, missionId),
    });
    if (!missionRow || missionRow.businessId !== businessId) {
      return { success: false, error: "Mission not found" };
    }

    const soulRows = await db
      .select({ content: memory.content })
      .from(memory)
      .where(and(eq(memory.businessId, businessId), eq(memory.scope, "business")))
      .orderBy(desc(memory.updatedAt))
      .limit(1);
    const soulMarkdown = soulRows[0]?.content?.trim() ? soulRows[0].content : "";

    const roster = await db.query.agents.findMany({
      where: eq(agents.businessId, businessId),
      columns: { id: true, slug: true, role: true },
    });

    const engineeringManager = findEngineeringManagerAgent(roster);
    const engineeringContextLines = pickAgentsForPromptContext(roster);

    const simulatedPromptContext = [
      `Business soul (latest business-scope memory):`,
      soulMarkdown ? soulMarkdown.slice(0, 1200) : "(empty)",
      "",
      `Mission: ${missionRow.name}`,
      `Validation contract:`,
      missionRow.validationContract.trim() ? missionRow.validationContract.trim().slice(0, 1200) : "(empty)",
      "",
      `Sprint goal (PO markdown brief):`,
      (sprintRow.goal ?? "").trim() ? (sprintRow.goal ?? "").trim().slice(0, 1200) : "(empty)",
      "",
      `Engineering Manager roster match:`,
      engineeringManager
        ? `- ${engineeringManager.slug ?? "(no slug)"} — ${engineeringManager.role}`
        : "(no engineering manager agent matched)",
      "",
      `Engineering team roster (target roles):`,
      ...engineeringContextLines,
    ].join("\n");

    // TODO: wire runCursorAgent when agent runtime is ready

    const simulatedTasks = buildSimulatedEmTasks({
      missionName: missionRow.name,
      sprintGoal: sprintRow.goal ?? "",
      validationContract: missionRow.validationContract,
      preparedPromptContextChars: simulatedPromptContext.length,
    });

    const taskIds = await db.transaction(async (tx) => {
      const sprintLocked = await tx.query.sprints.findFirst({
        where: eq(sprints.id, sprintId),
      });
      if (!sprintLocked || sprintLocked.missionId !== missionId) {
        throw new Error("Sprint not found for this approval");
      }
      if (sprintLocked.status !== "planning") {
        throw new Error("Sprint must be in planning status to decompose tasks");
      }

      const insertedIds: string[] = [];

      for (const item of simulatedTasks) {
        const agentId =
          roster.find((a) => agentMatchesSlug(a, item.agentSlug))?.id ?? null;

        const [created] = await tx
          .insert(tasks)
          .values({
            businessId,
            missionId,
            sprintId,
            title: item.title,
            description: item.description,
            status: "backlog",
            agentId,
            priority: item.priority,
          })
          .returning({ id: tasks.id });

        if (!created?.id) throw new Error("Failed to create task");
        insertedIds.push(created.id);
      }

      await tx.update(sprints).set({ status: "active" }).where(eq(sprints.id, sprintId));

      return insertedIds;
    });

    revalidatePath("/dashboard/tasks");
    revalidatePath(`/dashboard/missions/${missionId}`);
    revalidatePath(`/dashboard/approvals/${approvalId}`);

    return { success: true, taskIds };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to run Engineering Manager decomposition";
    return { success: false, error: message };
  }
}
