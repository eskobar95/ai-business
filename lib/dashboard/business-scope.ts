import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { getDb } from "@/db/index";
import { businesses, userBusinesses } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

import { isOnboardingPath } from "./onboarding-path";

export { isDashboardAddBusinessPath, isOnboardingPath } from "./onboarding-path";
/** @deprecated Use `isOnboardingPath` */
export { isOnboardingPath as isDashboardOnboardingPath };

/**
 * When the session user has no businesses, only `/onboarding` applies (not dashboard).
 * `/dashboard/onboarding` is only for adding an **extra** business once they already have one.
 * Requires `x-pathname` from middleware.
 */
export async function redirectToOnboardingIfNoBusinesses(
  pathname: string | null | undefined,
): Promise<void> {
  if (pathname && isOnboardingPath(pathname)) {
    return;
  }

  const rows = await loadUserBusinesses();
  if (rows.length === 0) {
    redirect("/onboarding");
  }
}

export async function loadUserBusinesses(): Promise<{ id: string; name: string }[]> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") {
    redirect("/auth/sign-in");
  }

  const db = getDb();
  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
    })
    .from(userBusinesses)
    .innerJoin(businesses, eq(userBusinesses.businessId, businesses.id))
    .where(eq(userBusinesses.userId, userId))
    .orderBy(asc(businesses.createdAt));

  return rows;
}

/** Call after `auth.getSession()` has yielded a `userId` to avoid a second session fetch (e.g. dashboard). */
export async function loadUserBusinessesWithSeedStatusForUser(
  userId: string,
): Promise<{ id: string; name: string; templateSeeded: boolean }[]> {
  const db = getDb();
  return db
    .select({
      id: businesses.id,
      name: businesses.name,
      templateSeeded: businesses.templateSeeded,
    })
    .from(userBusinesses)
    .innerJoin(businesses, eq(userBusinesses.businessId, businesses.id))
    .where(eq(userBusinesses.userId, userId))
    .orderBy(asc(businesses.createdAt));
}

/** Same as `loadUserBusinessesWithSeedStatusForUser` but loads session — use the ForUser variant when you already have `userId`. */
export async function loadUserBusinessesWithSeedStatus(): Promise<
  { id: string; name: string; templateSeeded: boolean }[]
> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") {
    redirect("/auth/sign-in");
  }

  return loadUserBusinessesWithSeedStatusForUser(userId);
}

/** Dashboard routes that scope state with `?businessId=`. */
export type DashboardScopedPath =
  | "/dashboard/agents"
  | "/dashboard/teams"
  | "/dashboard/tasks"
  | "/dashboard/skills"
  | "/dashboard/approvals"
  | "/dashboard/notion"
  | "/dashboard/webhooks"
  | "/dashboard/settings"
  | "/dashboard/settings/integrations"
  | "/dashboard/missions"
  | "/dashboard/communication";

/** Ensures `businessId` belongs to the session user; otherwise redirects with first business or onboarding. */
export async function resolveBusinessIdParam(
  businessIdParam: string | undefined,
  redirectBasePath: DashboardScopedPath,
): Promise<string> {
  const rows = await loadUserBusinesses();
  if (rows.length === 0) {
    redirect("/onboarding");
  }

  const valid =
    typeof businessIdParam === "string" &&
    businessIdParam.length > 0 &&
    rows.some((r) => r.id === businessIdParam);

  if (valid) {
    return businessIdParam!;
  }

  redirect(`${redirectBasePath}?businessId=${rows[0]!.id}`);
}
