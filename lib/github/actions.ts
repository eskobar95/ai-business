"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import { githubInstallations } from "@/db/schema";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { deleteGithubInstallationByBusiness, getGithubInstallationByBusiness, tryDecryptGithubInstallationToken } from "@/lib/github/installation-db";
import { githubRevokeInstallationAccessToken } from "@/lib/github/rest";
import { requireSessionUserId } from "@/lib/roster/session";

/**
 * Persist the user-selected subset of repos for this workspace.
 * Pass an empty array to clear selection (falls back to all repos).
 */
export async function updateSelectedRepos(
  businessId: string,
  selectedRepos: string[],
): Promise<{ success: true } | { success: false; error: string }> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);
  const db = getDb();
  const row = await getGithubInstallationByBusiness(db, businessId);
  if (!row) return { success: false, error: "No GitHub installation found for this workspace." };

  const validRepos = selectedRepos.filter((r) => row.repos.includes(r));
  await db
    .update(githubInstallations)
    .set({ selectedRepos: validRepos.length > 0 ? validRepos : null, updatedAt: new Date() })
    .where(eq(githubInstallations.businessId, businessId));

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function disconnectGithubInstallation(businessId: string): Promise<void> {
  const userId = await requireSessionUserId();
  await assertUserBusinessAccess(userId, businessId);
  const db = getDb();
  const row = await getGithubInstallationByBusiness(db, businessId);
  if (row) {
    const token = tryDecryptGithubInstallationToken(row);
    if (token) {
      try {
        await githubRevokeInstallationAccessToken(token);
      } catch (err) {
        // Local tenant disconnect must still succeed if GitHub returns an error or the network fails.
        const message =
          err instanceof Error ? err.message :
          typeof err === "string" ?
            err
          : "unknown error";
        console.warn("[github] disconnect revoke failed (disconnect continues locally):", message);
      }
    }
  }
  await deleteGithubInstallationByBusiness(db, businessId);
  revalidatePath("/dashboard/settings");
}
