import { SignJWT } from "jose";
import { createPrivateKey } from "node:crypto";

/** Normalize PEM loaded from `.env` (supports escaped `\n` and base64-wrapped PEM). */
export function normalizeGithubAppPrivateKey(raw: string): string {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "").trim();
  if (trimmed.includes("BEGIN")) {
    return trimmed.replace(/\\n/g, "\n");
  }
  const decoded = Buffer.from(trimmed, "base64").toString("utf8");
  if (!decoded.includes("BEGIN")) {
    throw new Error("GITHUB_APP_PRIVATE_KEY must be PEM or base64-encoded PEM");
  }
  return decoded.replace(/\\n/g, "\n");
}

/**
 * Short-lived JWT for GitHub App API calls (JWT auth).
 * @see https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
 */
export async function createGithubAppJwt(): Promise<string> {
  const appIdRaw = process.env.GITHUB_APP_ID?.trim();
  if (!appIdRaw) {
    throw new Error("GITHUB_APP_ID is not configured");
  }
  const pem = normalizeGithubAppPrivateKey(process.env.GITHUB_APP_PRIVATE_KEY ?? "");
  const key = createPrivateKey({ key: pem, format: "pem" });
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(appIdRaw)
    .sign(key);
}
