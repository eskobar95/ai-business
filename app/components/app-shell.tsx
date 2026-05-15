import { auth } from "@/lib/auth/server";
import { countPendingApprovalsForUser } from "@/lib/approvals/queries";
import { loadUserBusinesses } from "@/lib/dashboard/business-scope";
import { listTeamsByBusiness } from "@/lib/teams/actions";

import { AppSidebar } from "./sidebar";

export const dynamic = "force-dynamic";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = await auth.getSession();
  const uid = session?.user?.id;
  const pending =
    typeof uid === "string" ? await countPendingApprovalsForUser(uid) : 0;
  const userEmail = session?.user?.email ?? null;

  let sidebarTeams: { id: string; name: string }[] = [];
  let primaryBusinessId: string | null = null;
  let primaryBusinessName: string | null = null;
  let allBusinesses: { id: string; name: string }[] = [];

  if (typeof uid === "string") {
    try {
      const businesses = await loadUserBusinesses();
      allBusinesses = businesses.map((b) => ({ id: b.id, name: b.name }));
      primaryBusinessId = businesses[0]?.id ?? null;
      primaryBusinessName = businesses[0]?.name ?? null;
      if (primaryBusinessId) {
        const teams = await listTeamsByBusiness(primaryBusinessId);
        sidebarTeams = teams.map((t) => ({ id: t.id, name: t.name }));
      }
    } catch {
      // gracefully skip sidebar teams if fetch fails
    }
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <AppSidebar
        pendingApprovalsCount={pending}
        userEmail={userEmail}
        teams={sidebarTeams}
        businessId={primaryBusinessId}
        businessName={primaryBusinessName}
        allBusinesses={allBusinesses}
      />
      {/* Only this area scrolls — sidebar stays locked */}
      <main className="min-w-0 flex-1 overflow-y-auto pt-12 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
