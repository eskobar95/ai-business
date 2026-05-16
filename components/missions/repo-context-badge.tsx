"use client";

import type { RepoSummary } from "@/lib/github/repo-summary-types";

const COMMIT_PREVIEW_LEN = 40;

function truncateCommit(msg: string): string {
  const t = msg.trim();
  if (t.length <= COMMIT_PREVIEW_LEN) return t;
  return `${t.slice(0, COMMIT_PREVIEW_LEN)}…`;
}

/**
 * Compact chip linking to GitHub + latest commit preview (missions header).
 */
export function RepoContextBadge({ repoSummary }: { repoSummary: RepoSummary | null }) {
  if (!repoSummary) return null;

  const latest = repoSummary.recentCommits[0];

  return (
    <div className="flex max-w-[min(420px,55vw)] flex-col items-end gap-0.5 text-right sm:flex-row sm:items-center sm:gap-3 sm:text-left">
      <a
        href={repoSummary.repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center rounded-full border border-border bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-white/[0.1]"
      >
        {repoSummary.repoName}
      </a>
      {latest ? (
        <p className="truncate text-[11px] text-muted-foreground" title={`${latest.sha} ${latest.message}`}>
          <span className="font-mono text-muted-foreground/90">{latest.sha}</span>
          {" · "}
          {truncateCommit(latest.message)}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">No recent commits loaded</p>
      )}
    </div>
  );
}
