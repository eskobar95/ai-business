import Link from "next/link";

import { MissionCard } from "@/components/missions/mission-card";
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
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] py-16 text-center">
            <p className="text-[14px] font-semibold text-foreground">No missions yet</p>
            <p className="max-w-md text-[12px] text-muted-foreground/70">
              Start by creating your first mission. Your Product Owner will turn it into a sprint brief.
            </p>
            <Link
              href={`/dashboard/missions/new?businessId=${encodeURIComponent(businessId)}`}
              className="mt-2 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Create first mission
            </Link>
          </div>
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
