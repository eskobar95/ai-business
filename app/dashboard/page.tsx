import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  PlayCircle,
  ShieldAlert,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { PendingApprovalsQueueClient } from "@/components/dashboard/pending-approvals-queue-client";
import { SetupBanner } from "@/components/dashboard/setup-banner";
import { auth } from "@/lib/auth/server";
import { loadUserBusinessesWithSeedStatusForUser } from "@/lib/dashboard/business-scope";
import {
  getDashboardActivityFeed,
  getDashboardSummaryStats,
  listPendingApprovalsPreviewForUser,
} from "@/lib/dashboard/home-data";
import { getTemplatePreview } from "@/lib/templates/get-template-preview";

export const dynamic = "force-dynamic";

function formatRelativeTime(iso: Date): string {
  const diff = Date.now() - iso.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return iso.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof PlayCircle;
  label: string;
  value: number;
  accent?: "lime" | "amber" | "red";
}) {
  const valueColor =
    accent === "lime"
      ? "text-primary"
      : accent === "amber"
        ? "text-warning"
        : accent === "red" && value > 0
          ? "text-destructive"
          : "text-foreground";

  const iconColor =
    accent === "lime"
      ? "text-primary/60"
      : accent === "amber"
        ? "text-warning/60"
        : accent === "red" && value > 0
          ? "text-destructive/60"
          : "text-muted-foreground/40";

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3.5">
      <div className="flex items-center justify-between">
        <p className="section-label">{label}</p>
        <Icon className={`size-3.5 ${iconColor}`} aria-hidden />
      </div>
      <p className={`text-2xl font-semibold tabular-nums tracking-tight ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}

function ActivityKindBadge({ kind }: { kind: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    task: { label: "TASK", cls: "text-primary/70 bg-primary/10" },
    approval: { label: "APPR", cls: "text-warning/70 bg-warning/10" },
    agent_event: { label: "AGNT", cls: "text-blue-400/70 bg-blue-400/10" },
  };
  const { label, cls } = map[kind] ?? { label: kind.slice(0, 4).toUpperCase(), cls: "text-muted-foreground bg-white/[0.05]" };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest ${cls}`}>
      {label}
    </span>
  );
}

export default async function DashboardPage() {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") redirect("/auth/sign-in");

  const [stats, activity, pendingPreview, businessesWithSeed] = await Promise.all([
    getDashboardSummaryStats(userId),
    getDashboardActivityFeed(userId, 20),
    listPendingApprovalsPreviewForUser(userId, 5),
    loadUserBusinessesWithSeedStatusForUser(userId),
  ]);

  const seedTarget = businessesWithSeed.find((b) => !b.templateSeeded);
  let templatePreview: ReturnType<typeof getTemplatePreview> | null = null;
  let templatePreviewError: string | null = null;
  if (seedTarget) {
    try {
      templatePreview = getTemplatePreview();
    } catch (e) {
      templatePreviewError =
        e instanceof Error ? e.message : "Failed to load enterprise template bundle.";
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Command Center" />

      <div className="flex-1 px-6 py-5 space-y-5">
        {seedTarget && (
          <SetupBanner
            businessId={seedTarget.id}
            preview={templatePreview}
            previewError={templatePreviewError}
          />
        )}
        {/* Stat row — Supabase style with section label above */}
        <div>
          <p className="section-label mb-3">Overview</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={PlayCircle} label="Tasks in progress" value={stats.tasksInProgress} accent="lime" />
            <Stat icon={AlertCircle} label="Blocked tasks" value={stats.blockedTasks} accent="amber" />
            <Stat icon={ShieldAlert} label="Pending approvals" value={stats.pendingApprovals} accent="red" />
            <Stat icon={Bot} label="Active agents" value={stats.activeAgents} accent="lime" />
          </div>
        </div>

        {/* Activity + Approvals — two columns, stretch to fill */}
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          {/* Activity feed — dense log table à la Supabase */}
          <div className="flex flex-col rounded-md border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <div>
                <h2 className="text-[13px] font-medium text-foreground">Activity</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Recent events across all workspaces
                </p>
              </div>
              <Link
                href="/dashboard/tasks"
                className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                View tasks →
              </Link>
            </div>

            {activity.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
                <div className="size-8 rounded-full border border-border flex items-center justify-center">
                  <PlayCircle className="size-4 text-muted-foreground/40" />
                </div>
                <p className="text-[13px] text-muted-foreground">No activity yet</p>
                <p className="text-[11px] text-muted-foreground/50">
                  Activity appears here when tasks and agents are active
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Table header */}
                <div className="grid grid-cols-[80px_1fr_80px] border-b border-white/[0.05] px-4 py-1.5">
                  <span className="section-label">Type</span>
                  <span className="section-label">Event</span>
                  <span className="section-label text-right">Time</span>
                </div>
                {/* Rows */}
                {activity.map((item, i) => (
                  <div
                    key={item.id}
                    className={`grid grid-cols-[80px_1fr_80px] items-center gap-2 px-4 py-2 ${
                      i < activity.length - 1 ? "border-b border-white/[0.04]" : ""
                    } hover:bg-white/[0.02] transition-colors`}
                  >
                    <div>
                      <ActivityKindBadge kind={item.kind} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-foreground/90 leading-snug">
                        {item.label}
                      </p>
                      {item.sublabel && (
                        <p className="truncate font-mono text-[10px] text-muted-foreground/50 mt-0.5">
                          {item.sublabel}
                        </p>
                      )}
                    </div>
                    <p className="text-right font-mono text-[10px] text-muted-foreground/40 tabular-nums">
                      {formatRelativeTime(item.at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approvals queue */}
          <div className="flex flex-col rounded-md border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[13px] font-medium text-foreground">Approvals</h2>
                  {stats.pendingApprovals > 0 && (
                    <span className="rounded-full bg-destructive/90 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white tabular-nums">
                      {stats.pendingApprovals > 99 ? "99+" : stats.pendingApprovals}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Human approval gates</p>
              </div>
              <Link
                href="/dashboard/approvals"
                className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </Link>
            </div>

            {stats.pendingApprovals === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
                <CheckCircle2 className="size-5 text-success/60" aria-hidden />
                <p className="text-[13px] text-muted-foreground">All caught up</p>
                <p className="text-[11px] text-muted-foreground/50">
                  No approvals waiting for review
                </p>
              </div>
            ) : (
              <div className="p-3">
                <PendingApprovalsQueueClient items={pendingPreview} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
