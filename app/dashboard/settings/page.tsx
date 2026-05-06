import { redirect } from "next/navigation";

import type { SettingsSectionId } from "@/components/settings/settings-subnav";
import { BranchSettingsForm } from "@/components/settings/branch-settings-form";
import { CursorDefaultsForm } from "@/components/settings/cursor-defaults-form";
import { MemoryEditor } from "@/components/settings/memory-editor";
import { ParallelSettingsForm } from "@/components/settings/parallel-settings-form";
import { SettingsSubNav } from "@/components/settings/settings-subnav";
import { auth } from "@/lib/auth/server";
import { resolveBusinessIdParam } from "@/lib/dashboard/business-scope";
import { getSettingsPageState } from "@/lib/settings/actions";

import { SettingsAccountSection } from "./settings-account-section";
import { SettingsBusinessProfileSection } from "./settings-business-profile-section";
import { SettingsBusinessSection } from "./settings-business-section";
import { SettingsMcpSection } from "./settings-mcp-section";
import { SettingsWebhooksSection } from "./settings-webhooks-section";
import { SettingsIntegrationsSection } from "./settings-integrations-section";

export const dynamic = "force-dynamic";

function parseSection(raw: string | undefined): SettingsSectionId {
  if (
    raw === "account" ||
    raw === "business" ||
    raw === "workspace" ||
    raw === "execution" ||
    raw === "memory" ||
    raw === "mcp" ||
    raw === "webhooks" ||
    raw === "integrations"
  ) {
    return raw;
  }
  return "account";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string; section?: string; github?: string }>;
}) {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const { hasCursorApiKey, businesses } = await getSettingsPageState();
  const sp = await searchParams;
  const businessId = await resolveBusinessIdParam(sp.businessId, "/dashboard/settings");
  const section = parseSection(sp.section);
  const githubFlash = typeof sp.github === "string" ? sp.github : undefined;

  if (businesses.length === 0) {
    return (
      <div className="flex h-svh flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-white/[0.07] px-6">
          <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">Settings</h1>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[13px] text-muted-foreground/50">
            Create a workspace from &ldquo;New business&rdquo; before configuring settings.
          </p>
        </div>
      </div>
    );
  }

  const businessRow = businesses.find((b) => b.id === businessId)!;

  const SECTION_META: Record<SettingsSectionId, { title: string; description: string }> = {
    account: {
      title: "Cursor Integration",
      description:
        "Connect your Cursor API key to enable local runner integration. The key is encrypted and stored securely.",
    },
    business: {
      title: "Business",
      description: "Manage your business profile, name, and identity.",
    },
    workspace: {
      title: "Workspace",
      description: "Configure paths and metadata so Cursor CLI can find this project locally.",
    },
    execution: {
      title: "Workspace execution",
      description:
        "Branches for integration and release, parallel run limits, and default Cursor model settings.",
    },
    memory: {
      title: "Business memory",
      description: "Markdown and rich notes injected into agent runs when business context is enabled.",
    },
    mcp: {
      title: "MCP Library",
      description: "Connect MCP servers and map credentials to agents for this workspace.",
    },
    webhooks: {
      title: "Webhooks",
      description: "Inbound webhooks and delivery audit log for this workspace.",
    },
    integrations: {
      title: "Integrations",
      description: "Connect external services such as GitHub for agent automation.",
    },
  };

  const meta = SECTION_META[section];

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      {/* Flush header */}
      <header className="flex h-14 shrink-0 items-center border-b border-white/[0.07] px-6">
        <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">Settings</h1>
      </header>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left subnav panel */}
        <div className="w-[220px] shrink-0 overflow-y-auto border-r border-white/[0.07]">
          {/* Nav items */}
          <nav aria-label="Settings sections" className="flex flex-col gap-0.5 p-2 pt-3">
            <SettingsSubNav businessId={businessId} active={section} />
          </nav>
        </div>

        {/* Right content area */}
        <div key={section} className="animate-panel-enter flex-1 overflow-y-auto px-8 py-7">
          {/* Section header */}
          <div className="mb-6">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              {meta.title}
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground/50">{meta.description}</p>
          </div>

          {section === "account" ? (
            <SettingsAccountSection hasCursorApiKey={hasCursorApiKey} />
          ) : null}
          {section === "business" ? (
            <SettingsBusinessProfileSection businessId={businessId} business={businessRow} />
          ) : null}
          {section === "workspace" ? (
            <SettingsBusinessSection businessId={businessId} business={businessRow} />
          ) : null}
          {section === "execution" ? (
            <div className="flex max-w-3xl flex-col gap-12">
              <div>
                <h3 className="mb-4 text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                  Branch settings
                </h3>
                <BranchSettingsForm
                  businessId={businessId}
                  initialIntegrationBranch={businessRow.integrationBranch}
                  initialReleaseBranch={businessRow.releaseBranch}
                />
              </div>
              <div>
                <h3 className="mb-4 text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                  Parallel run limit
                </h3>
                <ParallelSettingsForm
                  businessId={businessId}
                  initialMaxParallelRuns={businessRow.maxParallelRuns}
                />
              </div>
              <div>
                <h3 className="mb-4 text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                  Cursor defaults
                </h3>
                <CursorDefaultsForm
                  businessId={businessId}
                  initialDefaultCursorModelId={businessRow.defaultCursorModelId}
                  initialDefaultCursorThinkingEffort={businessRow.defaultCursorThinkingEffort}
                />
              </div>
            </div>
          ) : null}
          {section === "memory" ? (
            <MemoryEditor businessId={businessId} initialSections={businessRow.memorySections} />
          ) : null}
          {section === "mcp" ? <SettingsMcpSection businessId={businessId} /> : null}
          {section === "webhooks" ? <SettingsWebhooksSection businessId={businessId} /> : null}
          {section === "integrations" ? (
            <SettingsIntegrationsSection businessId={businessId} flash={githubFlash} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
