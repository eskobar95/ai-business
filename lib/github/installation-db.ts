import { eq } from "drizzle-orm";

import { githubInstallations } from "@/db/schema";
import type { AppDb } from "@/lib/templates/db-types";

import type { McpEncryptedPayload } from "@/lib/mcp/encryption";
import { decryptCredential, encryptCredential } from "@/lib/mcp/encryption";

const INSTALLATION_TOKEN_FIELD = "installationToken";

/** Persist token rows after GitHub App installation completes. */
export async function upsertGithubInstallationTokens(
  db: AppDb,
  params: {
    businessId: string;
    installationId: string;
    accountLogin: string;
    accountType: "User" | "Organization";
    repos: string[];
    plainToken: string;
    expiresAt: Date;
  },
): Promise<void> {
  const envelope = encryptCredential({ installationToken: params.plainToken });
  await db
    .insert(githubInstallations)
    .values({
      businessId: params.businessId,
      installationId: params.installationId,
      accountLogin: params.accountLogin,
      accountType: params.accountType,
      repos: params.repos,
      tokenIv: envelope.ivBase64,
      tokenEncrypted: envelope.encryptedPayload,
      tokenExpiresAt: params.expiresAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: githubInstallations.businessId,
      set: {
        installationId: params.installationId,
        accountLogin: params.accountLogin,
        accountType: params.accountType,
        repos: params.repos,
        tokenIv: envelope.ivBase64,
        tokenEncrypted: envelope.encryptedPayload,
        tokenExpiresAt: params.expiresAt,
        updatedAt: new Date(),
      },
    });
}

export async function deleteGithubInstallationByBusiness(db: AppDb, businessId: string): Promise<void> {
  await db.delete(githubInstallations).where(eq(githubInstallations.businessId, businessId));
}

export type GithubInstallationRow = typeof githubInstallations.$inferSelect;

export async function getGithubInstallationByBusiness(
  db: AppDb,
  businessId: string,
): Promise<GithubInstallationRow | undefined> {
  const [row] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.businessId, businessId))
    .limit(1);
  return row;
}

export async function updateGithubInstallationToken(
  db: AppDb,
  businessId: string,
  patch: {
    plainToken: string;
    expiresAt: Date;
  },
): Promise<void> {
  const envelope = encryptCredential({ installationToken: patch.plainToken });
  await db
    .update(githubInstallations)
    .set({
      tokenIv: envelope.ivBase64,
      tokenEncrypted: envelope.encryptedPayload,
      tokenExpiresAt: patch.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(githubInstallations.businessId, businessId));
}

export function encryptedPayloadFromRow(row: GithubInstallationRow): {
  iv: string;
  payload: McpEncryptedPayload;
} | null {
  if (!row.tokenIv || !row.tokenEncrypted) return null;
  return { iv: row.tokenIv, payload: row.tokenEncrypted as McpEncryptedPayload };
}

/** Decrypts stored installation token for server-side use (disconnect, runner). Never log return value. */
export function tryDecryptGithubInstallationToken(row: GithubInstallationRow): string | null {
  const boxed = encryptedPayloadFromRow(row);
  if (!boxed) return null;
  try {
    const plain = decryptCredential(boxed.iv, boxed.payload as McpEncryptedPayload) as Record<
      string,
      unknown
    >;
    const v = plain[INSTALLATION_TOKEN_FIELD];
    return typeof v === "string" && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}
