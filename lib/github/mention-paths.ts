/**
 * Extract repository-relative paths from a user chat message for server-side prefetch.
 * Only paths under known top-level roots are returned (max {@link MAX_MENTIONED_REPO_PATHS}).
 */

export const MAX_MENTIONED_REPO_PATHS = 5;

const ROOT_PREFIX =
  /^(lib|src|app|components|hooks|runner|db|docs|scripts)\//i;

/** Paths like `lib/foo/bar.ts` or `` `lib/foo` `` matching {@link ROOT_PREFIX}. */
export function parseMentionedRepoPaths(text: string): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    let p = raw
      .trim()
      .replace(/^[`'"]|[`'"]$/g, "")
      .replace(/\\/g, "/")
      .replace(/^\/+/u, "");
    if (!p || p.includes("..")) return;
    if (!ROOT_PREFIX.test(p)) return;
    if (!seen.has(p)) {
      seen.add(p);
      ordered.push(p);
    }
  };

  const reBare = /\b(?:lib|src|app|components|hooks|runner|db|docs|scripts)\/[\w./@-]+/gi;
  let m: RegExpExecArray | null;
  while ((m = reBare.exec(text)) !== null) {
    let path = m[0];
    path = path.replace(/[`'"'",;:)\].}]+$/u, "");
    push(path);
  }

  const reBacktick =
    /`((?:lib|src|app|components|hooks|runner|db|docs|scripts)\/[\w./@-]+)`/gi;
  while ((m = reBacktick.exec(text)) !== null) {
    push(m[1]!);
  }

  return ordered.slice(0, MAX_MENTIONED_REPO_PATHS);
}
