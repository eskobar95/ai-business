import Link from "next/link";
import { Rocket } from "lucide-react";

import { ConductorNudge } from "@/components/dashboard/conductor-nudge";
import { MissionCard } from "@/components/missions/mission-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";
import { listMissionsOverview } from "@/lib/missions/actions";

export const dynamic = "force-dynamic";

export default async function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/missions");
  const rows = await listMissionsOverview(businessId);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div>
          <p className="section-label mb-0.5">Missions</p>
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">Overview</h1>
        </div>
        <Link
          href={`/dashboard/missions/new?businessId=${encodeURIComponent(businessId)}`}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-white/[0.04]"
        >
          New mission
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {rows.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="Ingen missions endnu"
            description="Start din første mission og lad dit agent-team gå i gang."
            className="border-white/[0.12] bg-white/[0.02] py-16"
            action={
              <div className="flex w-full max-w-md flex-col items-center gap-4">
                <Button asChild>
                  <Link
                    href={`/dashboard/missions/new?businessId=${encodeURIComponent(businessId)}`}
                  >
                    Opret første mission
                  </Link>
                </Button>
                <ConductorNudge
                  businessId={businessId}
                  label="Hvad er en mission? Spørg Conductor"
                />
              </div>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => (
              <MissionCard key={r.id} row={r} businessId={businessId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
