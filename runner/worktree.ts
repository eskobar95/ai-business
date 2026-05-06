import { mkdirSync } from "node:fs";
import { join, resolve as pathResolve } from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Safe child path inside repo root.
 * Uses the same sanitisation rules as `safeWorktreePath` in `git-preflight.ts` — keep them aligned.
 */
function safeWorktreeBranchDir(rootAbs: string, taskId: string): string {
  const safeTask = taskId.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 72);
  if (!safeTask) {
    throw new Error("Sanitized task id is empty — cannot create worktree");
  }
  const nested = ".worktrees";
  mkdirSync(join(rootAbs, nested), { recursive: true });
  const target = join(rootAbs, nested, safeTask);
  return target;
}

function assertCleanRepo(repoAbs: string): void {
  const out = execFileSync("git", ["-C", repoAbs, "status", "--porcelain"], {
    encoding: "utf8",
  });
  if (out.trim().length > 0) {
    throw new Error(
      "Git repo has unstaged/uncommitted changes. Commit or stash before runner worktrees.",
    );
  }
}

/**
 * Engineers run in `.worktrees/<taskId>` for isolation; otherwise use repo root.
 * Returns cwd + async cleanup (`git worktree remove`).
 */
export function prepareWorkingDirectory(options: {
  localPathAbs: string;
  useWorktree: boolean;
  /** When useWorktree, required (UUID of task etc.). */
  worktreeKey?: string;
}): { cwd: string; cleanup: () => void } {
  const rootAbs = pathResolve(options.localPathAbs.trim());
  if (!options.useWorktree) {
    return { cwd: rootAbs, cleanup: () => undefined };
  }
  const key = options.worktreeKey?.trim();
  if (!key) {
    throw new Error("Engineer orchestration requires taskId when using worktrees");
  }
  assertCleanRepo(rootAbs);
  const workDir = safeWorktreeBranchDir(rootAbs, key);
  const branchName = `runner/${key}`;
  try {
    execFileSync(
      "git",
      ["-C", rootAbs, "worktree", "add", "-b", branchName, workDir, "HEAD"],
      {
        encoding: "utf8",
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`git worktree add failed: ${msg}`);
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
      try {
        execFileSync("git", ["-C", rootAbs, "branch", "-D", branchName], {
          encoding: "utf8",
        });
      } catch {
        /* branch may not exist */
      }
    },
  };
}
