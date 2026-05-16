/**
 * Fetches a concise repository summary from GitHub API for use in agent prompts.
 * Uses the business's GitHub App installation token (auto-refreshed).
 */

import { getDb } from "@/db/index";
import { businesses, githubInstallations, githubInstallationSelectedRepos } from "@/db/schema";
import { eq } from "drizzle-orm";

import { getInstallationToken } from "./client";

interface GhFile {
  path: string;
  type: "blob" | "tree";
}

interface GhCommit {
  commit: { message: string; author: { date: string } };
}

interface GhTree {
  tree: GhFile[];
  truncated: boolean;
}

/** Parse "owner/repo" from a GitHub URL or "owner/repo" string. */
function parseOwnerRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/(?:github\.com\/)?([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
  if (!m?.[1] || !m[2]) return null;
  return { owner: m[1], repo: m[2] };
}

async function ghFetch<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "ai-business-platform",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Returns a formatted markdown block describing the repo, or null if GitHub
 * is not connected / the repo can't be read.
 *
 * Fetches:
 *  - README (first 3000 chars)
 *  - Top-level directory listing
 *  - 8 most recent commit messages
 */
export async function buildRepoContextForPrompt(businessId: string): Promise<string | null> {
  const db = getDb();

  // Resolve primary repo URL: prefer user-selected, fall back to businesses.githubRepoUrl
  const installation = await db.query.githubInstallations.findFirst({
    where: eq(githubInstallations.businessId, businessId),
    columns: { id: true },
  });

  let repoUrl: string | null = null;

  if (installation) {
    const selected = await db.query.githubInstallationSelectedRepos.findFirst({
      where: eq(githubInstallationSelectedRepos.installationId, installation.id),
      columns: { repoUrl: true },
    });
    if (selected?.repoUrl) repoUrl = selected.repoUrl;
  }

  if (!repoUrl) {
    const biz = await db.query.businesses.findFirst({
      where: eq(businesses.id, businessId),
      columns: { githubRepoUrl: true },
    });
    repoUrl = biz?.githubRepoUrl ?? null;
  }

  if (!repoUrl) return null;

  const parsed = parseOwnerRepo(repoUrl);
  if (!parsed) return null;

  const { owner, repo } = parsed;

  // Get installation access token (auto-refreshes near expiry)
  let token: string;
  try {
    token = await getInstallationToken(businessId);
  } catch {
    return null;
  }

  const base = `/repos/${owner}/${repo}`;

  // Fetch in parallel
  const [readmeData, treeData, commitsData] = await Promise.all([
    ghFetch<{ content?: string; encoding?: string }>(`${base}/readme`, token),
    ghFetch<GhTree>(`${base}/git/trees/HEAD?recursive=0`, token),
    ghFetch<GhCommit[]>(`${base}/commits?per_page=8`, token),
  ]);

  const parts: string[] = [`## Repository: ${owner}/${repo}`];

  // Top-level structure
  if (treeData?.tree) {
    const topLevel = treeData.tree
      .filter((f) => !f.path.includes("/"))
      .map((f) => `${f.type === "tree" ? "📁" : "📄"} ${f.path}`)
      .join("\n");
    if (topLevel) parts.push(`\n### File structure (top level)\n${topLevel}`);
  }

  // README
  if (readmeData?.content && readmeData.encoding === "base64") {
    const text = Buffer.from(readmeData.content.replace(/\n/g, ""), "base64")
      .toString("utf-8")
      .slice(0, 3_000);
    parts.push(`\n### README\n${text}${text.length >= 3_000 ? "\n…(truncated)" : ""}`);
  }

  // Recent commits
  if (commitsData && commitsData.length > 0) {
    const log = commitsData
      .map((c) => `- ${c.commit.message.split("\n")[0]} (${c.commit.author.date.slice(0, 10)})`)
      .join("\n");
    parts.push(`\n### Recent commits\n${log}`);
  }

  if (parts.length === 1) return null; // only header, nothing useful

  return parts.join("\n");
}
