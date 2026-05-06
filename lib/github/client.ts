/**
 * Installation access token retrieval for server-side tooling (runner, integrations).
 */

import { getDb } from "@/db/index";

import {
  getGithubInstallationByBusiness,
  tryDecryptGithubInstallationToken,
  updateGithubInstallationToken,
  type GithubInstallationRow,
} from "@/lib/github/installation-db";
import { githubCreateInstallationAccessToken } from "@/lib/github/rest";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

async function persistRefreshedToken(row: GithubInstallationRow, businessId: string): Promise<string> {
  const { token, expiresAt } = await githubCreateInstallationAccessToken(row.installationId);
  const db = getDb();
  await updateGithubInstallationToken(db, businessId, { plainToken: token, expiresAt });
  return token;
}

/** Returns decrypted installation access token, refreshing shortly before expiry. */
export async function getInstallationToken(businessId: string): Promise<string> {
  const db = getDb();
  const row = await getGithubInstallationByBusiness(db, businessId);
  if (!row) {
    throw new Error("GitHub App is not connected for this business");
  }

  const existing = tryDecryptGithubInstallationToken(row);
  const exp = row.tokenExpiresAt?.getTime() ?? null;
  const now = Date.now();
  const stale = existing === null || exp === null || exp - now < REFRESH_MARGIN_MS;

  if (stale) {
    return persistRefreshedToken(row, businessId);
  }

  return existing!;
}
