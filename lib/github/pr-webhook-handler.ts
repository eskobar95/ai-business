import { getDb } from "@/db/index";
import { businesses, githubInstallations, tasks } from "@/db/schema";
import { logEvent } from "@/lib/orchestration/events";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

type DbClient = ReturnType<typeof getDb>;

export type GithubInstallationRow = typeof githubInstallations.$inferSelect;

/** Minimal subset of GitHub pull_request payloads we persist. */
export interface GitHubPRPayload {
  action: string;
  number: number;
  pull_request: {
    merged: boolean;
    base: { ref: string };
    head: { ref: string };
  };
  repository: {
    full_name: string;
  };
  installation?: { id: number };
}

export type ParsedGithubPullRequest =
  | { ok: true; payload: GitHubPRPayload }
  | { ok: false; reason: string };

/** Validates minimal fields required by `handlePullRequestEvent`. */
export function parseGithubPullRequestWebhook(body: Record<string, unknown>): ParsedGithubPullRequest {
  if (typeof body.action !== "string" || body.action.trim() === "") {
    return { ok: false, reason: "invalid_action" };
  }

  if (typeof body.number !== "number" || !Number.isFinite(body.number)) {
    return { ok: false, reason: "invalid_pr_number" };
  }

  const pr = body.pull_request;
  if (!pr || typeof pr !== "object") {
    return { ok: false, reason: "missing_pull_request" };
  }

  const prRecord = pr as Record<string, unknown>;

  if (typeof prRecord.merged !== "boolean") {
    return { ok: false, reason: "invalid_pr_merged" };
  }

  const base = prRecord.base;
  const head = prRecord.head;
  if (
    !base ||
    typeof base !== "object" ||
    typeof (base as { ref?: unknown }).ref !== "string" ||
    (base as { ref: string }).ref.trim() === ""
  ) {
    return { ok: false, reason: "invalid_pr_base" };
  }
  if (
    !head ||
    typeof head !== "object" ||
    typeof (head as { ref?: unknown }).ref !== "string" ||
    (head as { ref: string }).ref.trim() === ""
  ) {
    return { ok: false, reason: "invalid_pr_head" };
  }

  const repo = body.repository;
  if (!repo || typeof repo !== "object") {
    return { ok: false, reason: "missing_repository" };
  }

  const fullNameRaw = (repo as { full_name?: unknown }).full_name;
  if (typeof fullNameRaw !== "string" || fullNameRaw.trim() === "") {
    return { ok: false, reason: "invalid_repository_full_name" };
  }

  let installation: { id: number } | undefined;
  const rawInst = body.installation;
  if (
    rawInst !== null &&
    rawInst !== undefined &&
    typeof rawInst === "object" &&
    typeof (rawInst as { id?: unknown }).id === "number"
  ) {
    const id = (rawInst as { id: number }).id;
    if (Number.isFinite(id)) {
      installation = { id };
    }
  }

  return {
    ok: true,
    payload: {
      action: body.action.trim(),
      number: body.number,
      pull_request: {
        merged: prRecord.merged,
        base: { ref: (base as { ref: string }).ref.trim() },
        head: { ref: (head as { ref: string }).ref.trim() },
      },
      repository: { full_name: fullNameRaw.trim() },
      ...(installation ? { installation } : {}),
    },
  };
}

/** Maps GitHub pull_request webhook actions to persisted `tasks.github_pr_status`. */
export function mapActionToGithubPrStatus(action: string, merged: boolean): string | null {
  if (action === "opened" || action === "reopened" || action === "ready_for_review") {
    return "open";
  }
  if (action === "converted_to_draft") return "draft";
  if (action === "closed" && merged) return "merged";
  if (action === "closed" && !merged) return "closed";
  return null;
}

/**
 * Resolves platform install row via GitHub `installation.id` (preferred),
 * falling back to `repository.full_name` contained in persisted `repos` jsonb (`string[]`).
 */
export async function findGithubInstallationRow(
  db: DbClient,
  payload: {
    repository?: { full_name?: string };
    installation?: { id?: number };
  },
): Promise<GithubInstallationRow | undefined> {
  if (payload.installation?.id != null) {
    const byInstall = await db.query.githubInstallations.findFirst({
      where: eq(githubInstallations.installationId, String(payload.installation.id)),
    });
    if (byInstall) return byInstall;
  }

  const fullName = payload.repository?.full_name?.trim();
  if (!fullName) return undefined;

  const needle = JSON.stringify([fullName]);
  const rows = await db
    .select()
    .from(githubInstallations)
    .where(sql`${githubInstallations.repos}::jsonb @> ${needle}::jsonb`)
    .orderBy(asc(githubInstallations.createdAt), asc(githubInstallations.id))
    .limit(1);

  return rows[0];
}

function isMergedToIntegrationGate(
  payload: GitHubPRPayload,
  integrationBranch: string | null | undefined,
): boolean {
  return (
    payload.action === "closed" &&
    payload.pull_request.merged === true &&
    integrationBranch != null &&
    integrationBranch !== "" &&
    payload.pull_request.base.ref === integrationBranch
  );
}

export async function handlePullRequestEvent(
  payload: GitHubPRPayload,
  options?: { cachedInstallation?: GithubInstallationRow },
): Promise<void> {
  const db = getDb();

  const installation =
    options?.cachedInstallation ?? (await findGithubInstallationRow(db, payload));
  if (!installation) return;

  const businessId = installation.businessId;

  const business = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { integrationBranch: true },
  });
  const integrationBranch = business?.integrationBranch;

  const newStatus = mapActionToGithubPrStatus(payload.action, payload.pull_request.merged);
  const mergedToIntegration = isMergedToIntegrationGate(payload, integrationBranch);

  const matchingTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.githubPrNumber, payload.number),
      eq(tasks.githubRepoInstallationId, installation.id),
    ),
  });

  if (matchingTasks.length === 0) {
    return;
  }

  if (newStatus == null && !mergedToIntegration) {
    return;
  }

  const updates: Partial<typeof tasks.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (newStatus != null) {
    updates.githubPrStatus = newStatus;
  }

  if (mergedToIntegration) {
    updates.prMergedToIntegration = true;
    updates.gatesLockedAt = new Date();
  }

  const taskIds = matchingTasks.map((t) => t.id);
  await db.update(tasks).set(updates).where(inArray(tasks.id, taskIds));

  if (mergedToIntegration) {
    await logEvent({
      type: "github.pr.merged",
      businessId,
      payload: {
        prNumber: payload.number,
        repoFullName: payload.repository.full_name,
        baseBranch: payload.pull_request.base.ref,
        headBranch: payload.pull_request.head.ref,
        affectedTaskIds: matchingTasks.map((t) => t.id),
      },
      status: "succeeded",
      correlationKey: `github-pr-${installation.id}-${payload.number}`,
    });
  }
}
