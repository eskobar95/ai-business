/**
 * Lightweight GitHub repo snapshot for mission UI (wizard + detail).
 * Server-only — uses installation token; never import from Client Components.
 */

import type { RepoSummary } from "./repo-summary-types";
import { getInstallationToken } from "./client";
import { listRepoPath } from "./repo-files";
import { parseOwnerRepo, resolveRepoUrl } from "./repo-context";

export type { RepoSummary } from "./repo-summary-types";

interface GhCommitListItem {
  sha: string;
  commit: { message: string; author: { date?: string } | null };
}

async function ghFetchJson<T>(path: string, token: string, timeoutMs = 15_000): Promise<T | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "conduro-ai-platform/1.0",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function normalizeGithubRepoUrl(repoUrl: string, owner: string, repo: string): string {
  const trimmed = repoUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const u = new URL(trimmed);
      if (u.hostname.includes("github.com")) {
        return `https://github.com/${owner}/${repo}`;
      }
    } catch {
      /* fall through */
    }
  }
  return `https://github.com/${owner}/${repo}`;
}

function firstLine(message: string): string {
  const line = message.split(/\r?\n/)[0]?.trim() ?? "";
  return line || "(no message)";
}

/**
 * Repo name, canonical GitHub URL, root-level entries, and five latest commits.
 * Returns null when GitHub is not configured or requests fail.
 */
export async function buildRepoSummaryForMission(
  businessId: string,
): Promise<RepoSummary | null> {
  const repoUrlRaw = await resolveRepoUrl(businessId);
  if (!repoUrlRaw) return null;

  const parsed = parseOwnerRepo(repoUrlRaw);
  if (!parsed) return null;

  const { owner, repo } = parsed;
  const repoName = `${owner}/${repo}`;
  const repoUrl = normalizeGithubRepoUrl(repoUrlRaw, owner, repo);

  let token: string;
  try {
    token = await getInstallationToken(businessId);
  } catch {
    return null;
  }

  const base = `/repos/${owner}/${repo}`;

  const [listing, commitsJson] = await Promise.all([
    listRepoPath(businessId, "").catch(() => null),
    ghFetchJson<GhCommitListItem[]>(`${base}/commits?per_page=5`, token),
  ]);

  if (!listing && !commitsJson) {
    return null;
  }

  const topLevel =
    listing?.entries
      .map((e) => ({ name: e.name, type: e.type }))
      .sort((a, b) => a.name.localeCompare(b.name)) ?? [];

  const recentCommits =
    commitsJson?.map((c) => ({
      sha: c.sha?.slice(0, 7) ?? "",
      message: firstLine(c.commit?.message ?? ""),
      date: c.commit?.author?.date ?? "",
    })) ?? [];

  if (topLevel.length === 0 && recentCommits.length === 0) {
    return null;
  }

  return {
    repoName,
    repoUrl,
    topLevel,
    recentCommits,
  };
}
