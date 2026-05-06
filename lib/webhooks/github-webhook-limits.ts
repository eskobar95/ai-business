const DEFAULT_MAX_BYTES = 1024 * 1024; // 1 MiB — enough for typical PR payloads; GitHub allows much larger.

/**
 * Max raw body size for `POST /api/github/webhook`. Override with `GITHUB_WEBHOOK_MAX_BODY_BYTES`
 * (decimal integer, bytes).
 */
export function resolveGithubWebhookMaxBodyBytes(): number {
  const raw = process.env.GITHUB_WEBHOOK_MAX_BODY_BYTES?.trim();
  if (!raw) return DEFAULT_MAX_BYTES;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_BYTES;
  return n;
}

export function parseContentLengthBytes(headerValue: string | null): number | null {
  if (headerValue == null || headerValue.trim() === "") return null;
  const n = Number.parseInt(headerValue.trim(), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** True when buffered UTF-8 body exceeds the resolved GitHub webhook size limit. */
export function bufferedGithubWebhookBodyExceedsLimit(byteLengthUtf8: number): boolean {
  return byteLengthUtf8 > resolveGithubWebhookMaxBodyBytes();
}

/** True when advertised Content-Length exceeds the limit (cheap pre-read guard). */
export function contentLengthHeaderExceedsGithubWebhookLimit(
  headerValue: string | null | undefined,
): boolean {
  const parsed = parseContentLengthBytes(headerValue ?? null);
  if (parsed == null) return false;
  return parsed > resolveGithubWebhookMaxBodyBytes();
}
