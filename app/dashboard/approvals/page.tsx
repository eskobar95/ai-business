import { after } from "next/server";

import { ApprovalsBoardClient } from "@/components/approvals/approvals-board-client";
import { backfillApprovedSprintBriefs } from "@/lib/approvals/actions";
import { listApprovalsGroupedForBusiness } from "@/lib/approvals/queries";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/approvals");

  // Schedule backfill to run after the response is sent — safe with Next.js `after()`.
  // Idempotent: skips approvals whose missions already have tasks.
  after(async () => {
    await backfillApprovedSprintBriefs(businessId).catch(() => {});
  });

  const grouped = await listApprovalsGroupedForBusiness(businessId);

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.07] px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">
            Approvals
          </h1>
          {grouped.pending.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400/15 px-1 font-mono text-[10px] text-amber-400 tabular-nums">
              {grouped.pending.length}
            </span>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-auto px-6 py-6">
        <ApprovalsBoardClient businessId={businessId} grouped={grouped} />
      </div>
    </div>
  );
}
