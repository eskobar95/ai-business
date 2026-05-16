import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db/index";
import { memory } from "@/db/schema";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";
import { buildRepoSummaryForMission } from "@/lib/github/repo-summary";
import { MissionWizard } from "./mission-wizard";

export const dynamic = "force-dynamic";

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/missions");

  const db = getDb();
  const [soulRow, repoSummary] = await Promise.all([
    db.query.memory.findFirst({
      where: and(
        eq(memory.businessId, businessId),
        eq(memory.scope, "business"),
        isNull(memory.agentId),
      ),
      columns: { content: true },
    }),
    buildRepoSummaryForMission(businessId).catch(() => null),
  ]);

  return (
    <MissionWizard
      businessId={businessId}
      soulContent={soulRow?.content ?? null}
      repoSummary={repoSummary}
    />
  );
}
