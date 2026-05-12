import { asc, eq, inArray } from "drizzle-orm";

import { githubInstallations, githubInstallationSelectedRepos } from "@/db/schema";
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

/**
 * Returns the explicitly selected repo URLs for an installation.
 * An empty array means no explicit selection (agents fall back to all repos).
 */
export async function getSelectedReposByInstallation(
  db: AppDb,
  installationId: string,
): Promise<string[]> {
  const rows = await db
    .select({ repoUrl: githubInstallationSelectedRepos.repoUrl })
    .from(githubInstallationSelectedRepos)
    .where(eq(githubInstallationSelectedRepos.installationId, installationId))
    .orderBy(
      asc(githubInstallationSelectedRepos.createdAt),
      asc(githubInstallationSelectedRepos.repoUrl),
    );
  return rows.map((r) => r.repoUrl);
}

/**
 * Replaces the selected-repo set for an installation atomically (delete + insert).
 * Pass an empty array to clear the selection (falls back to all repos).
 * All provided URLs are validated against `allowedRepos` — unknown URLs are silently dropped.
 */
export async function setSelectedReposForInstallation(
  db: AppDb,
  installationId: string,
  repoUrls: string[],
  allowedRepos: string[],
): Promise<void> {
  const valid = repoUrls.filter((r) => allowedRepos.includes(r));
  await db
    .delete(githubInstallationSelectedRepos)
    .where(eq(githubInstallationSelectedRepos.installationId, installationId));
  if (valid.length > 0) {
    await db.insert(githubInstallationSelectedRepos).values(
      valid.map((repoUrl) => ({ installationId, repoUrl })),
    );
  }
}

/** Removes all selected repos for a set of installations (used on cascade disconnect). */
export async function deleteSelectedReposByInstallations(
  db: AppDb,
  installationIds: string[],
): Promise<void> {
  if (installationIds.length === 0) return;
  await db
    .delete(githubInstallationSelectedRepos)
    .where(inArray(githubInstallationSelectedRepos.installationId, installationIds));
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
