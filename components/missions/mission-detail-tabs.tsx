"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import type { approvals, tasks as tasksTbl, missions, sprints } from "@/db/schema";
import { SprintCard } from "@/components/missions/sprint-card";
import { SprintFormInline } from "@/components/missions/sprint-form";
import { NovelEditor } from "@/components/ui/novel-editor";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomSelect } from "@/components/ui/custom-select";
import { updateMission } from "@/lib/missions/actions";

type MissionRow = typeof missions.$inferSelect;
type SprintRow = typeof sprints.$inferSelect;
type TaskBrief = Pick<
  typeof tasksTbl.$inferSelect,
  "id" | "title" | "status" | "sprintId"
>;
type ApprovalBrief = Pick<
  typeof approvals.$inferSelect,
  "id" | "artifactRef" | "approvalStatus" | "createdAt"
>;

const STATUS_META = [
  { id: "draft", label: "Draft" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" },
];

export function MissionDetailTabs({
  businessId,
  mission,
  tasks,
  approvalsRows,
  sprintSlot,
}: {
  businessId: string;
  mission: MissionRow & { sprintsMany: SprintRow[] };
  tasks: TaskBrief[];
  approvalsRows: ApprovalBrief[];
  sprintSlot?: ReactNode;
}) {
  const router = useRouter();
  const [prd, setPrd] = useState(mission.prd);
  const [name, setName] = useState(mission.name);
  const [status, setStatus] = useState(mission.status);
  const [pending, start] = useTransition();

  useEffect(() => {
    setPrd(mission.prd);
    setName(mission.name);
    setStatus(mission.status);
  }, [mission.prd, mission.name, mission.status, mission.updatedAt, mission.id]);

  const taskCountBySprint = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) {
      if (!t.sprintId) continue;
      m.set(t.sprintId, (m.get(t.sprintId) ?? 0) + 1);
    }
    return m;
  }, [tasks]);

  function refresh() {
    router.refresh();
  }

  function savePrd() {
    start(async () => {
      try {
        await updateMission(mission.id, { prd, name: name.trim(), status });
        toast.success("Mission saved.");
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  const unassignedTasks = tasks.filter((t) => !t.sprintId);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div className="flex min-w-[200px] flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="section-label" htmlFor="mission-name-edit">
              Name
            </label>
            <input
              id="mission-name-edit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-[14px] font-semibold outline-none"
            />
          </div>
          <div className="sm:w-48 flex flex-col gap-1.5">
            <span className="section-label">Status</span>
            <CustomSelect
              id="mission-status-detail"
              value={status}
              onChange={setStatus}
              options={STATUS_META}
            />
          </div>
        </div>
        <PrimaryButton type="button" disabled={pending} loading={pending} onClick={savePrd}>
          Save mission
        </PrimaryButton>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="overview" className="cursor-pointer font-mono text-[11px]">
            Overview
          </TabsTrigger>
          <TabsTrigger value="sprints" className="cursor-pointer font-mono text-[11px]">
            Sprints
          </TabsTrigger>
          <TabsTrigger value="tasks" className="cursor-pointer font-mono text-[11px]">
            Tasks
          </TabsTrigger>
          <TabsTrigger value="approvals" className="cursor-pointer font-mono text-[11px]">
            Approvals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 flex flex-col gap-3">
          <p className="section-label">PRD editor</p>
          <NovelEditor initialContent={prd} onHtmlChange={setPrd} />
        </TabsContent>

        <TabsContent value="sprints" className="mt-6 flex flex-col gap-6">
          {sprintSlot ?? (
            <>
              <SprintFormInline missionId={mission.id} onDone={refresh} />
              <div className="grid gap-4 lg:grid-cols-2">
                {mission.sprintsMany.map((sp) => (
                  <SprintCard
                    key={sp.id}
                    row={sp}
                    taskCount={taskCountBySprint.get(sp.id) ?? 0}
                    onRefresh={refresh}
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-6 flex flex-col gap-6">
          {tasks.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No linked tasks.</p>
          ) : (
            <>
              {mission.sprintsMany.map((sp) => (
                <section key={sp.id}>
                  <p className="section-label mb-2">{sp.name}</p>
                  <TaskMiniList tasks={tasks.filter((t) => t.sprintId === sp.id)} businessId={businessId} />
                </section>
              ))}
              {unassignedTasks.length > 0 && (
                <section>
                  <p className="section-label mb-2">Backlog / unassigned</p>
                  <TaskMiniList tasks={unassignedTasks} businessId={businessId} />
                </section>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="approvals" className="mt-6 flex flex-col gap-2">
          {approvalsRows.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Approvals referencing this mission (
              <code className="text-[11px]">kind: mission</code> or legacy{" "}
              <code className="text-[11px]">kind: project</code>) will show here once created via orchestration.
            </p>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border border-border overflow-hidden">
              {approvalsRows.map((a) => (
                <Link
                  key={a.id}
                  href={`/dashboard/approvals/${a.id}`}
                  className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3 hover:bg-white/[0.03] cursor-pointer"
                >
                  <span className="text-[13px] text-foreground">{a.approvalStatus}</span>
                  <span className="font-mono text-[11px] text-muted-foreground/50">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TaskMiniList({ tasks: list, businessId }: { tasks: TaskBrief[]; businessId: string }) {
  if (list.length === 0)
    return (
      <p className="text-[12px] text-muted-foreground/50 italic">No tasks</p>
    );
  return (
    <ul className="flex flex-col divide-y divide-white/[0.05] rounded-md border border-border">
      {list.map((t) => (
        <li key={t.id}>
          <Link
            href={`/dashboard/tasks/${t.id}?businessId=${encodeURIComponent(businessId)}`}
            className="flex cursor-pointer items-center justify-between px-4 py-2 hover:bg-white/[0.03]"
          >
            <span className="truncate text-[13px] text-foreground/90">{t.title}</span>
            <span className="font-mono text-[10px] uppercase text-muted-foreground/50">{t.status}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
