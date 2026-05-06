import { getDb } from "@/db/index";
import type { GithubInstallationPublic } from "@/lib/github/github-types";
import { getGithubInstallationByBusiness } from "@/lib/github/installation-db";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { requireSessionUserId } from "@/lib/roster/session";

/** Session-scoped projection for dashboards (never returns tokens). */
export async function fetchGithubInstallationForBusiness(
  businessId: string,
): Promise<GithubInstallationPublic | null> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);
  const db = getDb();
  const row = await getGithubInstallationByBusiness(db, businessId);
  if (!row) return null;

  return {
    installationId: row.installationId,
    accountLogin: row.accountLogin,
    accountType: row.accountType,
    repos: row.repos,
    updatedAt: row.updatedAt,
  };
}
