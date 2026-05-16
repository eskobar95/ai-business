/**
 * Read-only access to files and directories in the business's connected GitHub repo
 * via the Contents API (installation token). Server-only — never import from Client Components.
 *
 * Security: path traversal blocked; secret-ish paths and disallowed extensions rejected;
 * response bodies capped at {@link MAX_REPO_FILE_BYTES}.
 */

import { getInstallationToken } from "./client";
import { parseOwnerRepo, resolveRepoUrl } from "./repo-context";

/** Maximum decoded UTF-8 bytes returned for a single file read. */
export const MAX_REPO_FILE_BYTES = 100 * 1024;

const ALLOWED_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
  ".css",
  ".html",
  ".prisma",
  ".graphql",
]);

export class RepoFileAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepoFileAccessError";
  }
}

interface GhContentFile {
  type: "file";
  content?: string;
  encoding?: string;
  size?: number;
  message?: string;
}

interface GhContentDirItem {
  type: "file" | "dir";
  name: string;
  path: string;
}

function truncateUtf8(text: string, maxBytes: number): { text: string; truncated: boolean } {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return { text, truncated: false };
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(text.slice(0, mid), "utf8") <= maxBytes) low = mid;
    else high = mid - 1;
  }
  return { text: text.slice(0, low), truncated: true };
}

function decodeBase64(encoded: string): string {
  return Buffer.from(encoded.replace(/\n/g, ""), "base64").toString("utf-8");
}

/** True if `path` looks like a single file with an allowlisted extension (for read vs list heuristics). */
export function pathLooksLikeAllowedFile(path: string): boolean {
  const segments = path.replace(/^\/+/, "").split("/").filter(Boolean);
  const base = segments[segments.length - 1] ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = base.slice(dot).toLowerCase();
  return ALLOWED_FILE_EXTENSIONS.has(ext);
}

/**
 * Normalizes and validates a repo-relative path. `mode: "file"` enforces allowlisted extensions.
 * Empty string means repository root (directory listing only).
 */
export function normalizeRepoPath(raw: string, mode: "file" | "dir"): string {
  let p = raw.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (p.startsWith("/etc") || /^[a-zA-Z]:/.test(p)) {
    throw new RepoFileAccessError("Absolute or reserved paths are not allowed");
  }

  const segments = p.split("/").filter(Boolean);
  const joined = segments.join("/");
  const lowerJoined = joined.toLowerCase();

  if (lowerJoined.includes("secret") || lowerJoined.includes("credential")) {
    throw new RepoFileAccessError("Path contains forbidden keywords");
  }

  for (const seg of segments) {
    if (seg === "..") throw new RepoFileAccessError("Path traversal is not allowed");
    const lower = seg.toLowerCase();
    if (lower === ".git" || lower === ".ssh") {
      throw new RepoFileAccessError("Path segment is not allowed");
    }
    if (lower === ".env" || lower.startsWith(".env.")) {
      throw new RepoFileAccessError(".env paths are not allowed");
    }
    if (/\.(key|pem)$/i.test(seg)) {
      throw new RepoFileAccessError("Key/certificate paths are not allowed");
    }
  }

  if (mode === "file") {
    if (!joined) throw new RepoFileAccessError("Empty file path");
    const base = segments[segments.length - 1] ?? "";
    const dot = base.lastIndexOf(".");
    const ext = dot >= 0 ? base.slice(dot).toLowerCase() : "";
    if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
      throw new RepoFileAccessError(`File extension not allowed: ${ext || "(none)"}`);
    }
  }

  return joined;
}

async function githubContentsJson<T>(
  owner: string,
  repo: string,
  repoRelativePath: string,
  token: string,
  ref?: string,
  timeoutMs = 15_000,
): Promise<{ ok: boolean; status: number; json: T | null }> {
  const encoded =
    repoRelativePath === ""
      ? ""
      : repoRelativePath.split("/").map(encodeURIComponent).join("/");
  const pathPart = encoded === "" ? "/contents" : `/contents/${encoded}`;
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const url = `https://api.github.com/repos/${owner}/${repo}${pathPart}${query}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "conduro-ai-platform/1.0",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, json: null };
    }
    return { ok: true, status: res.status, json: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

async function resolveOwnerRepoToken(businessId: string): Promise<{
  owner: string;
  repo: string;
  token: string;
}> {
  const repoUrl = await resolveRepoUrl(businessId);
  if (!repoUrl) throw new RepoFileAccessError("No GitHub repository configured");
  const parsed = parseOwnerRepo(repoUrl);
  if (!parsed) throw new RepoFileAccessError("Could not parse repository URL");
  const token = await getInstallationToken(businessId);
  return { owner: parsed.owner, repo: parsed.repo, token };
}

/**
 * Fetch file contents from the default branch (or `ref`) as UTF-8 text.
 */
export async function readRepoFile(
  businessId: string,
  path: string,
  ref?: string,
): Promise<{ content: string; truncated: boolean }> {
  const normalized = normalizeRepoPath(path, "file");
  const { owner, repo, token } = await resolveOwnerRepoToken(businessId);

  const res = await githubContentsJson<GhContentFile>(owner, repo, normalized, token, ref);
  if (!res.ok || !res.json || res.json.type !== "file") {
    throw new RepoFileAccessError(
      res.status === 404 ? "File not found" : "Could not read file from GitHub",
    );
  }

  const payload = res.json;
  if (!payload.content || payload.encoding !== "base64") {
    throw new RepoFileAccessError("GitHub did not return file content (file too large or binary)");
  }

  const decoded = decodeBase64(payload.content);
  const sized = truncateUtf8(decoded, MAX_REPO_FILE_BYTES);
  return { content: sized.text, truncated: sized.truncated };
}

/**
 * List files and subdirectories directly under `path` (repository root when `path` is "").
 */
export async function listRepoPath(
  businessId: string,
  path: string,
  ref?: string,
): Promise<{ entries: { name: string; path: string; type: "file" | "dir" }[] }> {
  const normalized = normalizeRepoPath(path, "dir");
  const { owner, repo, token } = await resolveOwnerRepoToken(businessId);

  const res = await githubContentsJson<GhContentDirItem[]>(owner, repo, normalized, token, ref);
  if (!res.ok || !res.json) {
    throw new RepoFileAccessError(
      res.status === 404 ? "Path not found" : "Could not list directory from GitHub",
    );
  }

  if (!Array.isArray(res.json)) {
    throw new RepoFileAccessError("Path is not a directory");
  }

  const entries = res.json.map((item) => ({
    name: item.name,
    path: item.path,
    type: item.type === "dir" ? ("dir" as const) : ("file" as const),
  }));

  return { entries };
}
