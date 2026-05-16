import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";

import { StartChatButton } from "@/components/chat/start-chat-button";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { listAgentSummariesByBusiness } from "@/lib/agents/actions";
import { listChatSessions } from "@/lib/chat/actions";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";

export const dynamic = "force-dynamic";

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function ChatsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/chats");

  const [sessions, allAgents] = await Promise.all([
    listChatSessions(businessId),
    listAgentSummariesByBusiness(businessId),
  ]);

  // Map agentId → latest session
  const latestByAgent = new Map<string, (typeof sessions)[number]>();
  const allByAgent = new Map<string, (typeof sessions)>();
  for (const s of sessions) {
    if (!latestByAgent.has(s.agentId)) latestByAgent.set(s.agentId, s);
    const arr = allByAgent.get(s.agentId) ?? [];
    arr.push(s);
    allByAgent.set(s.agentId, arr);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center border-b border-white/[0.06] px-5">
        <h1 className="text-[13px] font-semibold tracking-tight text-foreground">Conversations</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-6 space-y-6">
          {allAgents.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground/50">
              No agents yet — add agents to start chatting.
            </p>
          )}

          {allAgents.map((agent) => {
            const agentSessions = allByAgent.get(agent.id) ?? [];
            const latest = latestByAgent.get(agent.id);

            return (
              <section key={agent.id}>
                {/* Agent row */}
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <AgentAvatar name={agent.name} status="idle" size="sm" />
                    <span className="text-[13px] font-medium text-foreground">{agent.name}</span>
                    {agentSessions.length > 0 && (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted-foreground/50 tabular-nums">
                        {agentSessions.length}
                      </span>
                    )}
                  </div>
                  <StartChatButton businessId={businessId} agentId={agent.id} />
                </div>

                {/* Sessions list */}
                {agentSessions.length > 0 ? (
                  <ul className="flex flex-col gap-1 pl-[38px]">
                    {agentSessions.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/dashboard/chats/${encodeURIComponent(s.id)}?businessId=${encodeURIComponent(businessId)}`}
                          className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]"
                        >
                          <p className="truncate text-[12px] text-muted-foreground/70 group-hover:text-foreground/80 transition-colors">
                            {s.title}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground/30">
                              <Clock className="size-2.5" />
                              {timeAgo(new Date(s.updatedAt))}
                            </span>
                            <ArrowRight className="size-3 text-muted-foreground/20 transition-colors group-hover:text-primary/60" />
                          </div>
                        </Link>
                      </li>
                    ))}
                    {latest && agentSessions.length > 1 && (
                      <li>
                        <Link
                          href={`/dashboard/chats/${encodeURIComponent(latest.id)}?businessId=${encodeURIComponent(businessId)}`}
                          className="flex items-center gap-1 pl-3 pt-0.5 text-[11px] text-primary/50 hover:text-primary/70 transition-colors"
                        >
                          Continue latest <ArrowRight className="size-2.5" />
                        </Link>
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="pl-[38px] text-[11px] text-muted-foreground/30 italic">
                    No conversations yet
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
