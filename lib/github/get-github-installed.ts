import { getDb } from "@/db/index";
import { githubInstallations } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Returns whether the GitHub App is installed for this business. */
export async function getGitHubInstalled(businessId: string): Promise<boolean> {
  const db = getDb();
  const row = await db
    .select({ id: githubInstallations.id })
    .from(githubInstallations)
    .where(eq(githubInstallations.businessId, businessId))
    .limit(1);
  return row.length > 0;
}
