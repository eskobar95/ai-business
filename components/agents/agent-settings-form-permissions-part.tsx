"use client";

import type { Dispatch, SetStateAction } from "react";

import { SectionDivider } from "@/components/agents/agent-settings-form-fields-part";
import { cn } from "@/lib/utils";

export type AgentSettingsPermissionsState = {
  createAgents: boolean;
  assignTasks: boolean;
  manageProjects: boolean;
  assignIssues: boolean;
  manageTeam: boolean;
};

function PermissionRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/[0.05] last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/50">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-[18px] w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
          "transition-colors duration-200 focus-visible:outline-none",
          checked ? "bg-primary" : "bg-white/[0.14]",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block size-[14px] rounded-full bg-white shadow ring-0",
            "transition-transform duration-200",
            checked ? "translate-x-[14px]" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

export function AgentSettingsPermissionsSection({
  permissions,
  setPermissions,
}: {
  permissions: AgentSettingsPermissionsState;
  setPermissions: Dispatch<SetStateAction<AgentSettingsPermissionsState>>;
}) {
  return (
    <>
      <SectionDivider label="Permissions" />

      <div className="mb-5 rounded-md border border-border px-4">
        <PermissionRow
          label="Can create new agents"
          description="Let this agent spawn and configure sub-agents"
          checked={permissions.createAgents}
          onChange={(v) => setPermissions((p) => ({ ...p, createAgents: v }))}
        />
        <PermissionRow
          label="Can assign tasks"
          description="Allow this agent to assign tasks to other agents"
          checked={permissions.assignTasks}
          onChange={(v) => setPermissions((p) => ({ ...p, assignTasks: v }))}
        />
        <PermissionRow
          label="Can manage missions"
          description="Create, update and archive missions"
          checked={permissions.manageProjects}
          onChange={(v) => setPermissions((p) => ({ ...p, manageProjects: v }))}
        />
        <PermissionRow
          label="Can assign issues"
          description="Assign issues to missions and team members"
          checked={permissions.assignIssues}
          onChange={(v) => setPermissions((p) => ({ ...p, assignIssues: v }))}
        />
        <PermissionRow
          label="Can manage team"
          description="Add or remove agents from teams"
          checked={permissions.manageTeam}
          onChange={(v) => setPermissions((p) => ({ ...p, manageTeam: v }))}
        />
      </div>
    </>
  );
}
