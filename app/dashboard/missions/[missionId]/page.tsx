import Link from "next/link";
import { notFound } from "next/navigation";

import { MissionDetailTabs } from "@/components/missions/mission-detail-tabs";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";
import { getMissionBundle } from "@/lib/missions/actions";
import { POBriefButton } from "./po-brief-button";
import { SprintList } from "./sprint-list";

export const dynamic = "force-dynamic";

export default async function MissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ missionId: string }>;
  searchParams: Promise<{ businessId?: string }>;
}) {
  const { missionId } = await params;
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/missions");

  let bundle;
  try {
    bundle = await getMissionBundle(missionId);
  } catch {
    notFound();
  }
  if (bundle.mission.businessId !== businessId) {
    notFound();
  }

  const taskCountBySprint = new Map<string, number>();
  for (const t of bundle.tasks) {
    if (t.sprintId) {
      taskCountBySprint.set(t.sprintId, (taskCountBySprint.get(t.sprintId) ?? 0) + 1);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <nav className="flex items-center gap-2 text-[13px]" aria-label="Breadcrumb">
          <Link
            href={`/dashboard/missions?businessId=${encodeURIComponent(businessId)}`}
            className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
          >
            Missions
          </Link>
          <span className="text-white/20">/</span>
          <span className="font-medium text-foreground">{bundle.mission.name}</span>
        </nav>
      </div>

      <MissionDetailTabs
        businessId={businessId}
        mission={bundle.mission}
        tasks={bundle.tasks}
        approvalsRows={bundle.approvals}
        sprintSlot={
          <>
            {bundle.mission.sprintsMany.length === 0 ? (
              <POBriefButton businessId={businessId} missionId={missionId} />
            ) : null}
            <SprintList missionId={missionId} taskCountBySprint={taskCountBySprint} />
          </>
        }
      />
    </div>
  );
}
