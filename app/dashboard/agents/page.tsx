import Link from "next/link";
import { Plus } from "lucide-react";

import { AgentsDashboardAutoRefresh } from "@/components/agents/agents-dashboard-auto-refresh";
import { AgentsRosterClient } from "@/components/agents/agents-roster-client";
import { GitHubBanner } from "@/components/dashboard/github-banner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getAgentsByBusiness } from "@/lib/agents/actions";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";
import { getGitHubInstalled } from "@/lib/github/get-github-installed";
import { getMcpCredentialsForAgent } from "@/lib/mcp/actions";
import { getAgentStatus } from "@/lib/orchestration/events";
import { getSkillsByAgent } from "@/lib/skills/actions";

export const dynamic = "force-dynamic";

export default async function AgentsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/agents");
  const [agents, githubConnected] = await Promise.all([
    getAgentsByBusiness(businessId),
    getGitHubInstalled(businessId),
  ]);

  const rows = await Promise.all(
    agents.map(async (a) => {
      const [skills, mcps, lifecycle] = await Promise.all([
        getSkillsByAgent(a.id),
        getMcpCredentialsForAgent(a.id),
        getAgentStatus(a.id),
      ]);
      return {
        agent: {
          id: a.id,
          name: a.name,
          role: a.role,
          avatarUrl: a.avatarUrl,
          iconKey: a.iconKey,
        },
        skillCount: skills.length,
        mcpCount: mcps.length,
        lifecycle,
      };
    }),
  );

  return (
    <div className="flex min-h-full flex-col">
      <AgentsDashboardAutoRefresh />

      <PageHeader
        title="Agents"
        action={
          <Button
            asChild
            size="sm"
            variant="outline"
            className="cursor-pointer gap-1.5"
            data-testid="agents-new"
          >
            <Link href={`/dashboard/agents/new?businessId=${encodeURIComponent(businessId)}`}>
              <Plus className="size-3.5" />
              New agent
            </Link>
          </Button>
        }
      />

      {/* Content */}
      <div className="flex-1 px-6 py-5">
        <GitHubBanner businessId={businessId} isConnected={githubConnected} />
        <AgentsRosterClient
          businessId={businessId}
          rows={rows}
          emptyCta={
            <Button asChild size="sm" variant="outline" data-testid="agents-empty-cta">
              <Link href={`/dashboard/agents/new?businessId=${encodeURIComponent(businessId)}`}>
                <Plus className="size-3.5" />
                Create first agent
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
