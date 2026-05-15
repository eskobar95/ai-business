import Link from "next/link";
import { ArrowRight, MessageSquare } from "lucide-react";

import { ConductorNudge } from "@/components/dashboard/conductor-nudge";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";
import { listChatSessions } from "@/lib/chat/actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatUpdatedAt(d: Date) {
  try {
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

export default async function ChatsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/chats");
  const sessions = await listChatSessions(businessId);

  const byAgent = new Map<
    string,
    {
      agentName: string;
      agentSlug: string | null;
      rows: typeof sessions;
    }
  >();

  for (const row of sessions) {
    const existing = byAgent.get(row.agentId);
    const name = row.agent?.name ?? "Agent";
    const slug = row.agent?.slug ?? null;
    if (existing) {
      existing.rows.push(row);
    } else {
      byAgent.set(row.agentId, { agentName: name, agentSlug: slug, rows: [row] });
    }
  }

  const agentGroups = [...byAgent.values()];

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-6">
        <div>
          <p className="section-label mb-0.5">Chats</p>
          <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
            Conversations
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {sessions.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            description="Start by chatting with Conductor."
            className="border-white/[0.12] bg-white/[0.02] py-16"
            action={
              <ConductorNudge
                businessId={businessId}
                label="Learn about Conductor"
              />
            }
          />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-10">
            {agentGroups.map((group) => (
              <section key={group.rows[0]!.agentId}>
                <div className="mb-3 flex items-center gap-3">
                  <AgentAvatar name={group.agentName} status="idle" size="sm" />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-foreground">
                      {group.agentName}
                    </h2>
                    {group.agentSlug ? (
                      <p className="text-muted-foreground truncate text-[11px]">
                        {group.agentSlug}
                      </p>
                    ) : null}
                  </div>
                </div>
                <ul className="flex flex-col gap-2">
                  {group.rows.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/dashboard/chats/${encodeURIComponent(s.id)}?businessId=${encodeURIComponent(businessId)}`}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3",
                          "transition-colors hover:border-border hover:bg-white/[0.04]",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground">
                            {s.title}
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-[11px] tabular-nums">
                            Updated {formatUpdatedAt(new Date(s.updatedAt))}
                          </p>
                        </div>
                        <span className="text-primary flex shrink-0 items-center gap-1 text-[12px] font-medium opacity-80 transition-opacity group-hover:opacity-100">
                          Continue
                          <ArrowRight className="size-3.5" aria-hidden />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
