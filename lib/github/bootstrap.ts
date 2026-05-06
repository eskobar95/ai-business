import { getDb } from "@/db/index";
import {
  githubFetchInstallationRaw,
  githubCreateInstallationAccessToken,
  githubListInstallationRepositoryFullNames,
  parseGithubInstallationAccount,
} from "@/lib/github/rest";
import { upsertGithubInstallationTokens } from "@/lib/github/installation-db";

/**
 * Called after user completes GitHub App installation (Setup URL hits our callback route).
 */
export async function finalizeGithubInstallationForBusiness(params: {
  businessId: string;
  installationId: string;
}): Promise<{ accountLogin: string; repoCount: number }> {
  const rawInstallation = await githubFetchInstallationRaw(params.installationId);
  const account = parseGithubInstallationAccount(rawInstallation);
  const { token, expiresAt } = await githubCreateInstallationAccessToken(params.installationId);
  const repos = await githubListInstallationRepositoryFullNames(token);

  const db = getDb();
  await upsertGithubInstallationTokens(db, {
    businessId: params.businessId,
    installationId: params.installationId,
    accountLogin: account.login,
    accountType: account.type,
    repos,
    plainToken: token,
    expiresAt,
  });

  return { accountLogin: account.login, repoCount: repos.length };
}
