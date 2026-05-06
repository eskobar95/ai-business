import { createHmac, timingSafeEqual } from "node:crypto";

import { loadEncryptionKeyFromEnv } from "@/lib/mcp/encryption";

export const GITHUB_PENDING_INSTALL_COOKIE = "github_install_business_pending";

const COOKIE_PAYLOAD_PREFIX = "g1.";
const TTL_MS = 15 * 60 * 1000;

function signPayload(payloadB64Url: string): string {
  const key = loadEncryptionKeyFromEnv();
  return createHmac("sha256", key).update(payloadB64Url).digest("base64url");
}

/**
 * Serialized value for HttpOnly cookie set before redirecting user to github.com/apps/... .
 * Verified on `/api/github/callback` alongside session + tenant access.
 */
export function encodeGithubInstallBusinessCookie(businessId: string): string {
  const body = Buffer.from(JSON.stringify({ businessId, exp: Date.now() + TTL_MS }), "utf8").toString(
    "base64url",
  );
  const sig = signPayload(body);
  return `${COOKIE_PAYLOAD_PREFIX}${body}.${sig}`;
}

export function verifyGithubInstallBusinessCookie(raw: string | undefined): string | null {
  if (!raw?.startsWith(COOKIE_PAYLOAD_PREFIX)) return null;
  const rest = raw.slice(COOKIE_PAYLOAD_PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  const expected = signPayload(payload);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (!decoded || typeof decoded !== "object") return null;
    const biz = "businessId" in decoded ? (decoded as { businessId?: unknown }).businessId : undefined;
    const exp = "exp" in decoded ? (decoded as { exp?: unknown }).exp : undefined;
    if (typeof biz !== "string" || !biz) return null;
    if (typeof exp !== "number") return null;
    if (Date.now() > exp) return null;
    return biz;
  } catch {
    return null;
  }
}
