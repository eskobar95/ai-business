import Link from "next/link";
import { notFound } from "next/navigation";

import { EMDecomposeButton } from "./em-decompose-button";
import { getApprovalDetailForUser } from "@/lib/approvals/queries";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";

export const dynamic = "force-dynamic";

function shouldShowEngineeringManagerDecompose(row: {
  approvalStatus: "pending" | "approved" | "rejected";
  artifactRef: Record<string, unknown>;
}): boolean {
  if (row.approvalStatus !== "approved") return false;
  const sprintId = row.artifactRef["sprintId"];
  if (typeof sprintId !== "string" || !sprintId.trim()) return false;

  const artifactType = row.artifactRef["artifactType"];
  if (artifactType !== undefined && artifactType !== "po_sprint_brief") return false;

  return true;
}

export default async function ApprovalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ approvalId: string }>;
  searchParams: Promise<{ businessId?: string }>;
}) {
  const { approvalId } = await params;
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/approvals");

  const row = await getApprovalDetailForUser(approvalId);
  if (!row || row.businessId !== businessId) {
    notFound();
  }

  return (
    <div className="bg-background text-foreground flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/dashboard/approvals?businessId=${encodeURIComponent(businessId)}`}
          className="text-muted-foreground hover:text-foreground text-sm underline"
        >
          ← Back to queue
        </Link>
      </div>

      <article className="border-border flex max-w-3xl flex-col gap-4 rounded-lg border p-6" data-testid="approval-detail">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Approval</h1>
          <p className="text-muted-foreground font-mono text-xs">{row.id}</p>
        </header>

        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium capitalize" data-testid="approval-detail-status">
              {row.approvalStatus}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{row.createdAt.toISOString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Decided</dt>
            <dd>{row.decidedAt ? row.decidedAt.toISOString() : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Agent</dt>
            <dd>{row.agentName ?? row.agentId ?? "—"}</dd>
          </div>
        </dl>

        <div>
          <h2 className="mb-2 text-sm font-medium">Comment</h2>
          <p className="text-muted-foreground text-sm">{row.comment ?? "—"}</p>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium">Artifact reference</h2>
          <pre className="bg-muted max-h-80 overflow-auto rounded-md p-3 text-xs">
            {JSON.stringify(row.artifactRef, null, 2)}
          </pre>
        </div>

        {shouldShowEngineeringManagerDecompose(row) ? (
          <div className="border-border rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-medium">Engineering handoff</h2>
            <EMDecomposeButton approvalId={row.id} businessId={businessId} />
          </div>
        ) : null}
      </article>
    </div>
  );
}
