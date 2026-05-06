import { getDb } from "@/db/index";
import { businesses, githubInstallations, tasks } from "@/db/schema";
import { logEvent } from "@/lib/orchestration/events";
import { and, eq } from "drizzle-orm";

type DbClient = ReturnType<typeof getDb>;

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
 * falling back to `repository.full_name` contained in persisted `repos` string[].
 */
export async function findGithubInstallationRow(
  db: DbClient,
  payload: {
    repository?: { full_name?: string };
    installation?: { id?: number };
  },
): Promise<(typeof githubInstallations.$inferSelect) | undefined> {
  if (payload.installation?.id != null) {
    const byInstall = await db.query.githubInstallations.findFirst({
      where: eq(githubInstallations.installationId, String(payload.installation.id)),
    });
    if (byInstall) return byInstall;
  }

  const fullName = payload.repository?.full_name?.trim();
  if (!fullName) return undefined;

  const rows = await db.query.githubInstallations.findMany({});
  return rows.find((r) => Array.isArray(r.repos) && r.repos.includes(fullName));
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

export async function handlePullRequestEvent(payload: GitHubPRPayload): Promise<void> {
  if (
    typeof payload.number !== "number" ||
    !payload.pull_request?.base?.ref ||
    !payload.pull_request?.head?.ref ||
    typeof payload.pull_request.merged !== "boolean" ||
    !payload.repository?.full_name
  ) {
    return;
  }

  const db = getDb();

  const installation = await findGithubInstallationRow(db, payload);
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

  for (const task of matchingTasks) {
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

    await db.update(tasks).set(updates).where(eq(tasks.id, task.id));
  }

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
