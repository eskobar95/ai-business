"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/db/index";
import { assertUserBusinessAccess } from "@/lib/grill-me/access";
import { deleteGithubInstallationByBusiness, getGithubInstallationByBusiness, tryDecryptGithubInstallationToken } from "@/lib/github/installation-db";
import { githubRevokeInstallationAccessToken } from "@/lib/github/rest";
import { requireSessionUserId } from "@/lib/roster/session";

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
