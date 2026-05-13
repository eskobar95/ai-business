import { MissionCreateForm } from "@/components/missions/mission-form";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";

export const dynamic = "force-dynamic";

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/missions");

  return <MissionCreateForm businessId={businessId} />;
}
