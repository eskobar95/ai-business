import { getDb } from "@/db/index";
import {
  agents,
  approvals,
  businesses,
  missions,
  orchestrationEvents,
  tasks,
  userBusinesses,
} from "@/db/schema";
import { countPendingApprovalsForUser } from "@/lib/approvals/queries";
import { requireSessionUserId } from "@/lib/roster/session";
import { getTaskCountsForUserBusinesses } from "@/lib/tasks/dashboard-queries";
import { and, count, desc, eq, sql } from "drizzle-orm";

export type DashboardSummaryStats = {
  tasksInProgress: number;
  blockedTasks: number;
  pendingApprovals: number;
  activeAgents: number;
};

/** Total missions rows across every business the user can access (for dashboard empty UX). */
export async function countMissionsAcrossUserBusinesses(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(missions)
    .innerJoin(userBusinesses, eq(missions.businessId, userBusinesses.businessId))
    .where(eq(userBusinesses.userId, userId));
  return Number(row?.n ?? 0);
}

export async function getDashboardSummaryStats(userId: string): Promise<DashboardSummaryStats> {
  const taskMap = await getTaskCountsForUserBusinesses();
  let tasksInProgress = 0;
  let blockedTasks = 0;
  for (const c of taskMap.values()) {
    tasksInProgress += c.inProgress;
    blockedTasks += c.blocked;
  }

  const pendingApprovals = await countPendingApprovalsForUser(userId);

  const db = getDb();
  const agentRows = await db
    .select({ id: agents.id })
    .from(agents)
    .innerJoin(userBusinesses, eq(agents.businessId, userBusinesses.businessId))
    .where(eq(userBusinesses.userId, userId));

  let activeAgents = 0;
  if (agentRows.length > 0) {
    // Single batch query — latest lifecycle event per agent via DISTINCT ON.
    // Avoids N+1 concurrent Neon HTTP calls that exhaust the serverless pool.
    const agentIds = agentRows.map((r) => r.id);
    const result = await db.execute<{ agent_id: string; lifecycle_status: string | null }>(sql`
      SELECT DISTINCT ON (payload->>'agentId')
        payload->>'agentId'          AS agent_id,
        payload->>'lifecycleStatus'  AS lifecycle_status
      FROM ${orchestrationEvents}
      WHERE payload->>'agentId' = ANY(ARRAY[${sql.join(agentIds.map((id) => sql`${id}`), sql`, `)}])
      ORDER BY payload->>'agentId', created_at DESC
    `);
    activeAgents = result.rows.filter((r) => r.lifecycle_status === "working").length;
  }

  return { tasksInProgress, blockedTasks, pendingApprovals, activeAgents };
}

export type DashboardActivityItem = {
  id: string;
  kind: "task" | "approval" | "agent_event";
  label: string;
  sublabel?: string;
  at: Date;
};

function formatApprovalSnippet(artifactRef: Record<string, unknown>): string {
  const title =
    (typeof artifactRef.title === "string" && artifactRef.title) ||
    (typeof artifactRef.summary === "string" && artifactRef.summary) ||
    "Approval submitted";
  return title.length > 120 ? `${title.slice(0, 117)}…` : title;
}

/** Recent cross-business activity for the dashboard feed (best-effort, DB-backed). */
export async function getDashboardActivityFeed(
  userId: string,
  limit = 10,
): Promise<DashboardActivityItem[]> {
  const db = getDb();
  const userFilter = eq(userBusinesses.userId, userId);

  const taskRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      updatedAt: tasks.updatedAt,
      businessName: businesses.name,
    })
    .from(tasks)
    .innerJoin(userBusinesses, eq(tasks.businessId, userBusinesses.businessId))
    .innerJoin(businesses, eq(tasks.businessId, businesses.id))
    .where(userFilter)
    .orderBy(desc(tasks.updatedAt))
    .limit(8);

  const approvalRows = await db
    .select({
      id: approvals.id,
      artifactRef: approvals.artifactRef,
      createdAt: approvals.createdAt,
      agentName: agents.name,
      businessName: businesses.name,
    })
    .from(approvals)
    .innerJoin(userBusinesses, eq(approvals.businessId, userBusinesses.businessId))
    .innerJoin(businesses, eq(approvals.businessId, businesses.id))
    .leftJoin(agents, eq(approvals.agentId, agents.id))
    .where(userFilter)
    .orderBy(desc(approvals.createdAt))
    .limit(8);

  const lifecycleRows = await db
    .select({
      id: orchestrationEvents.id,
      createdAt: orchestrationEvents.createdAt,
      payload: orchestrationEvents.payload,
      businessName: businesses.name,
    })
    .from(orchestrationEvents)
    .innerJoin(userBusinesses, eq(orchestrationEvents.businessId, userBusinesses.businessId))
    .innerJoin(businesses, eq(userBusinesses.businessId, businesses.id))
    .where(and(userFilter, eq(orchestrationEvents.type, "agent.lifecycle")))
    .orderBy(desc(orchestrationEvents.createdAt))
    .limit(8);

  const items: DashboardActivityItem[] = [];

  for (const t of taskRows) {
    items.push({
      id: `task-${t.id}`,
      kind: "task",
      label: `Task “${t.title}” → ${String(t.status).replaceAll("_", " ")}`,
      sublabel: t.businessName,
      at: t.updatedAt,
    });
  }

  for (const a of approvalRows) {
    const ref = a.artifactRef as Record<string, unknown>;
    items.push({
      id: `approval-${a.id}`,
      kind: "approval",
      label: formatApprovalSnippet(ref),
      sublabel: [a.businessName, a.agentName ? `Agent: ${a.agentName}` : null]
        .filter(Boolean)
        .join(" · "),
      at: a.createdAt,
    });
  }

  for (const e of lifecycleRows) {
    const p = e.payload as Record<string, unknown>;
    const status = typeof p.lifecycleStatus === "string" ? p.lifecycleStatus : "update";
    const agentId = typeof p.agentId === "string" ? p.agentId.slice(0, 8) : "agent";
    items.push({
      id: `evt-${e.id}`,
      kind: "agent_event",
      label: `Agent ${agentId} → ${status.replaceAll("_", " ")}`,
      sublabel: e.businessName,
      at: e.createdAt,
    });
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, limit);
}

export type PendingApprovalCard = {
  id: string;
  businessName: string;
  agentName: string | null;
  artifactLabel: string;
  createdAt: Date;
};

export async function listPendingApprovalsPreviewForUser(
  userId: string,
  limit = 5,
): Promise<PendingApprovalCard[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: approvals.id,
      createdAt: approvals.createdAt,
      agentName: agents.name,
      businessName: businesses.name,
      artifactRef: approvals.artifactRef,
    })
    .from(approvals)
    .innerJoin(userBusinesses, eq(approvals.businessId, userBusinesses.businessId))
    .innerJoin(businesses, eq(approvals.businessId, businesses.id))
    .leftJoin(agents, eq(approvals.agentId, agents.id))
    .where(and(eq(userBusinesses.userId, userId), eq(approvals.approvalStatus, "pending")))
    .orderBy(desc(approvals.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    businessName: r.businessName,
    agentName: r.agentName,
    createdAt: r.createdAt,
    artifactLabel: formatApprovalSnippet(r.artifactRef as Record<string, unknown>),
  }));
}

export type TaskStatusBreakdown = {
  backlog: number;
  inProgress: number;
  blocked: number;
  inReview: number;
  done: number;
};

export async function getTaskStatusBreakdownForUser(): Promise<Map<string, TaskStatusBreakdown>> {
  const userId = await requireSessionUserId();
  const db = getDb();
  const rows = await db
    .select({
      businessId: tasks.businessId,
      status: tasks.status,
      n: count(),
    })
    .from(tasks)
    .innerJoin(userBusinesses, eq(tasks.businessId, userBusinesses.businessId))
    .where(eq(userBusinesses.userId, userId))
    .groupBy(tasks.businessId, tasks.status);

  const map = new Map<string, TaskStatusBreakdown>();

  for (const r of rows) {
    const cur = map.get(r.businessId) ?? {
      backlog: 0,
      inProgress: 0,
      blocked: 0,
      inReview: 0,
      done: 0,
    };
    const n = Number(r.n);
    switch (r.status) {
      case "backlog":
        cur.backlog += n;
        break;
      case "in_progress":
        cur.inProgress += n;
        break;
      case "blocked":
        cur.blocked += n;
        break;
      case "in_review":
        cur.inReview += n;
        break;
      case "done":
        cur.done += n;
        break;
      default:
        break;
    }
    map.set(r.businessId, cur);
  }
  return map;
}
