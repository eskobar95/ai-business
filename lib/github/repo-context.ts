/**
 * GitHub repository context builder for agent prompts.
 *
 * Fetches a comprehensive snapshot of the connected repository using the
 * business's GitHub App installation token. Works entirely server-side —
 * no local checkout required.
 *
 * Fetches in parallel:
 *  - Full README (up to 6 000 chars)
 *  - Complete recursive file tree (paths only, depth ≤ 3)
 *  - Key files: package.json, pyproject.toml, Cargo.toml, go.mod, etc.
 *  - 15 most recent commits
 *  - 10 open pull requests
 *  - 10 open issues
 */

import { getDb } from "@/db/index";
import { businesses, githubInstallations, githubInstallationSelectedRepos } from "@/db/schema";
import { eq } from "drizzle-orm";

import { getInstallationToken } from "./client";

interface GhFile { path: string; type: "blob" | "tree" }
interface GhTree  { tree: GhFile[]; truncated: boolean }
interface GhCommit { commit: { message: string; author: { date: string; name: string } } }
interface GhPR     { number: number; title: string; state: string; body: string | null; head: { ref: string } }
interface GhIssue  { number: number; title: string; state: string; body: string | null; labels: { name: string }[] }
interface GhContent { content?: string; encoding?: string; message?: string }

/** Parse "owner/repo" from a full GitHub URL or a "owner/repo" shorthand. */
function parseOwnerRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:\/.*)?$/);
  if (!m?.[1] || !m[2]) return null;
  return { owner: m[1], repo: m[2] };
}

async function ghFetch<T>(path: string, token: string, timeoutMs = 10_000): Promise<T | null> {
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

function decodeBase64(encoded: string): string {
  return Buffer.from(encoded.replace(/\n/g, ""), "base64").toString("utf-8");
}

/** Key files to attempt fetching for tech-stack context. */
const KEY_FILES = [
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "requirements.txt",
  ".env.example",
  "docker-compose.yml",
  "Dockerfile",
];

/** Resolve the primary repo for a business (selected repo > githubRepoUrl). */
async function resolveRepoUrl(businessId: string): Promise<string | null> {
  const db = getDb();
  const installation = await db.query.githubInstallations.findFirst({
    where: eq(githubInstallations.businessId, businessId),
    columns: { id: true },
  });
  if (installation) {
    const selected = await db.query.githubInstallationSelectedRepos.findFirst({
      where: eq(githubInstallationSelectedRepos.installationId, installation.id),
      columns: { repoUrl: true },
    });
    if (selected?.repoUrl) return selected.repoUrl;
  }
  const biz = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    columns: { githubRepoUrl: true },
  });
  return biz?.githubRepoUrl ?? null;
}

/**
 * Returns a comprehensive markdown snapshot of the connected repo,
 * or null if GitHub is not connected / repo is unreachable.
 * All data is fetched from the GitHub API — no local checkout needed.
 */
export async function buildRepoContextForPrompt(businessId: string): Promise<string | null> {
  const repoUrl = await resolveRepoUrl(businessId);
  if (!repoUrl) return null;

  const parsed = parseOwnerRepo(repoUrl);
  if (!parsed) return null;
  const { owner, repo } = parsed;

  let token: string;
  try {
    token = await getInstallationToken(businessId);
  } catch {
    return null;
  }

  const base = `/repos/${owner}/${repo}`;

  // Fetch everything in parallel for speed
  const [readmeData, treeData, commitsData, prsData, issuesData, ...keyFileResults] =
    await Promise.all([
      ghFetch<GhContent>(`${base}/readme`, token),
      ghFetch<GhTree>(`${base}/git/trees/HEAD?recursive=1`, token),
      ghFetch<GhCommit[]>(`${base}/commits?per_page=15`, token),
      ghFetch<GhPR[]>(`${base}/pulls?state=open&per_page=10&sort=updated`, token),
      ghFetch<GhIssue[]>(`${base}/issues?state=open&per_page=10&sort=updated&labels=`, token),
      ...KEY_FILES.map((f) => ghFetch<GhContent>(`${base}/contents/${f}`, token)),
    ]);

  const parts: string[] = [
    `## GitHub Repository: ${owner}/${repo}`,
    `URL: https://github.com/${owner}/${repo}`,
    `\n> This is the live state of the repository fetched via GitHub API.`,
    `> Use this as your primary source of truth for codebase questions.`,
  ];

  // ── File tree (depth ≤ 3, skip node_modules / .git / build dirs) ──
  if (treeData?.tree) {
    const SKIP = /^(node_modules|\.git|dist|build|\.next|__pycache__|\.cache|coverage)(\/|$)/;
    const files = treeData.tree
      .filter((f) => !SKIP.test(f.path))
      .filter((f) => f.path.split("/").length <= 3)
      .map((f) => `  ${"  ".repeat(f.path.split("/").length - 1)}${f.type === "tree" ? "📁" : "📄"} ${f.path.split("/").pop()}`)
      .slice(0, 200);
    if (files.length) {
      parts.push(`\n### File structure\n\`\`\`\n${files.join("\n")}${treeData.truncated ? "\n…(truncated)" : ""}\n\`\`\``);
    }
  }

  // ── README ──
  if (readmeData?.content && readmeData.encoding === "base64") {
    const text = decodeBase64(readmeData.content).slice(0, 6_000);
    parts.push(`\n### README\n${text}${text.length >= 6_000 ? "\n…(truncated)" : ""}`);
  }

  // ── Key files (package.json etc.) ──
  const keyFileSections: string[] = [];
  for (let i = 0; i < KEY_FILES.length; i++) {
    const data = keyFileResults[i];
    if (data?.content && data.encoding === "base64") {
      const text = decodeBase64(data.content).slice(0, 2_000);
      keyFileSections.push(`**${KEY_FILES[i]}**\n\`\`\`\n${text}\n\`\`\``);
    }
  }
  if (keyFileSections.length) {
    parts.push(`\n### Key files\n${keyFileSections.join("\n\n")}`);
  }

  // ── Recent commits ──
  if (commitsData?.length) {
    const log = commitsData
      .map((c) => `- \`${c.commit.author.date.slice(0, 10)}\` ${c.commit.message.split("\n")[0]}`)
      .join("\n");
    parts.push(`\n### Recent commits\n${log}`);
  }

  // ── Open PRs ──
  if (prsData?.length) {
    const prList = prsData
      .map((pr) => `- #${pr.number} **${pr.title}** (\`${pr.head.ref}\`)${pr.body ? `\n  ${pr.body.slice(0, 200).replace(/\n/g, " ")}` : ""}`)
      .join("\n");
    parts.push(`\n### Open pull requests\n${prList}`);
  }

  // ── Open issues ──
  if (issuesData?.length) {
    // GitHub issues endpoint also returns PRs; filter those out
    const realIssues = issuesData.filter((i: GhIssue & { pull_request?: unknown }) => !("pull_request" in i));
    if (realIssues.length) {
      const issueList = realIssues
        .map((i) => {
          const labels = i.labels.map((l) => `\`${l.name}\``).join(", ");
          return `- #${i.number} **${i.title}**${labels ? ` [${labels}]` : ""}`;
        })
        .join("\n");
      parts.push(`\n### Open issues\n${issueList}`);
    }
  }

  if (parts.length <= 3) return null; // nothing useful was fetched

  return parts.join("\n");
}
