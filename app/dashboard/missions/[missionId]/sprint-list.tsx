import type { sprints as sprintsTable } from "@/db/schema";
import { listSprintsByMission } from "@/lib/sprints/actions";
import { SprintCardDetail } from "./sprint-card";
import { CreateSprintForm } from "./create-sprint-form";

type SprintRow = typeof sprintsTable.$inferSelect;

export async function SprintList({
  missionId,
  taskCountBySprint,
}: {
  missionId: string;
  taskCountBySprint: Map<string, number>;
}) {
  let rows: SprintRow[] = [];
  try {
    rows = await listSprintsByMission(missionId);
  } catch {
    rows = [];
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No sprints yet. Create your first sprint below.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((sp) => (
            <SprintCardDetail
              key={sp.id}
              row={sp}
              taskCount={taskCountBySprint.get(sp.id) ?? 0}
            />
          ))}
        </div>
      )}
      <CreateSprintForm missionId={missionId} />
    </div>
  );
}
