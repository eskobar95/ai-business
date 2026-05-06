import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve as pathResolve } from "node:path";

import { logEvent } from "@/lib/orchestration/events";

export interface GitPreflightOptions {
  localPath: string;
  integrationBranch: string;
  prBranch?: string;
  worktreeKey?: string;
  businessId: string;
  eventId: string;
}

/** Safe child path inside repo root; avoids path traversal outside `root`. */
function safeWorktreePath(rootAbs: string, key: string): string {
  const safeTask = key.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 72);
  if (!safeTask) throw new Error("Sanitized worktree key is empty");
  const nested = ".worktrees";
  mkdirSync(join(rootAbs, nested), { recursive: true });
  return join(rootAbs, nested, safeTask);
}

/**
 * Adds a worktree checked out at existing branch `prBranch`. Caller must have a clean repo
 * and `prBranch` present locally (after fetch).
 */
function preparePrWorktree(
  rootAbs: string,
  prBranch: string,
  worktreeKey: string,
): { cwd: string; cleanup: () => void } {
  const workDir = safeWorktreePath(rootAbs, worktreeKey);
  try {
    execFileSync("git", ["-C", rootAbs, "worktree", "add", workDir, prBranch], {
      encoding: "utf8",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`git worktree add failed for branch ${prBranch}: ${msg}`);
  }
  return {
    cwd: workDir,
    cleanup: () => {
      try {
        execFileSync("git", ["-C", rootAbs, "worktree", "remove", "--force", workDir], {
          encoding: "utf8",
        });
      } catch {
        /* best-effort */
      }
    },
  };
}

/**
 * Fetch, ensure clean tree, sync integration branch, optional PR-branch worktree.
 */
export async function runGitPreflight(
  opts: GitPreflightOptions,
): Promise<{ cwd: string; cleanup: () => void }> {
  const rootAbs = pathResolve(opts.localPath.trim());

  execFileSync("git", ["-C", rootAbs, "fetch", "origin"], { encoding: "utf8" });
  await logEvent({
    type: "runner.git_preflight",
    businessId: opts.businessId,
    payload: { step: "fetch", eventId: opts.eventId },
    status: "succeeded",
  });

  const dirty = execFileSync("git", ["-C", rootAbs, "status", "--porcelain"], {
    encoding: "utf8",
  });
  if (dirty.trim().length > 0) {
    throw new Error(
      `Dirty working tree — commit or stash changes before runner: ${dirty.trim().slice(0, 200)}`,
    );
  }

  execFileSync("git", ["-C", rootAbs, "checkout", opts.integrationBranch], { encoding: "utf8" });
  execFileSync("git", ["-C", rootAbs, "pull", "--ff-only", "origin", opts.integrationBranch], {
    encoding: "utf8",
  });
  await logEvent({
    type: "runner.git_preflight",
    businessId: opts.businessId,
    payload: {
      step: "checkout_integration",
      branch: opts.integrationBranch,
      eventId: opts.eventId,
    },
    status: "succeeded",
  });

  const pr = opts.prBranch?.trim();
  const key = opts.worktreeKey?.trim();
  if (pr && key) {
    const { cwd, cleanup } = preparePrWorktree(rootAbs, pr, key);
    await logEvent({
      type: "runner.git_preflight",
      businessId: opts.businessId,
      payload: { step: "pr_worktree", branch: pr, cwd, eventId: opts.eventId },
      status: "succeeded",
    });
    return { cwd, cleanup };
  }

  return { cwd: rootAbs, cleanup: () => undefined };
}
