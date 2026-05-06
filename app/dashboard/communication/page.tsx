import { CommunicationPageClient } from "@/components/communication/canvas-page-client";
import { PageHeader } from "@/components/ui/page-header";
import { listAgentsForCommunicationCanvas } from "@/lib/agents/actions";
import { listEdges } from "@/lib/communication/actions";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";

export const dynamic = "force-dynamic";

export default async function CommunicationDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/communication");
  const [agents, edges] = await Promise.all([
    listAgentsForCommunicationCanvas(businessId),
    listEdges(businessId),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Communication graph" />
      <div className="flex-1 px-6 py-5">
        <CommunicationPageClient businessId={businessId} agents={agents} edges={edges} />
      </div>
    </div>
  );
}
