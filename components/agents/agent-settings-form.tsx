"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Upload, X, Save } from "lucide-react";
import {
  AgentSettingsPermissionsSection,
  type AgentSettingsPermissionsState,
} from "@/components/agents/agent-settings-form-permissions-part";
import {
  AgentSettingsAdapterRunPolicySections,
  type AgentAdapterId,
} from "@/components/agents/agent-settings-form-adapter-run-policy-part";
import { FieldInput } from "@/components/agents/agent-settings-form-fields-part";
import { FieldHint } from "@/components/settings/field-hint";
import { PrimaryButton } from "@/components/ui/primary-button";

import { CustomSelect } from "@/components/ui/custom-select";

import { updateAgent, deleteAgent } from "@/lib/agents/actions";
import type { AgentWithInstructions } from "@/lib/agents/actions";
import type { agents, systemRoles as systemRolesTable } from "@/db/schema";
import type { AgentPlatformIconId } from "@/lib/agents/agent-platform-icon-ids";
import {
  AGENT_PLATFORM_ICON_IDS,
  isAgentPlatformIconId,
} from "@/lib/agents/agent-platform-icon-ids";
import {
  assertValidAgentAvatarUrl,
  maxAvatarUploadFileBytes,
} from "@/lib/agents/avatar-validation";
import {
  HEARTBEAT_PROMOTION_CAP_DEFAULT,
  parseHeartbeatPromotionCapFromForm,
} from "@/lib/agents/cursor-agent-config";
import { AGENT_PLATFORM_ICONS } from "@/components/agents/agent-platform-icons";
import { AgentRosterAvatar } from "@/components/agents/agent-roster-avatar";
import { cn } from "@/lib/utils";

type Peer = Pick<typeof agents.$inferSelect, "id" | "name" | "isPlatformDefault">;

type PlatformSystemRole = typeof systemRolesTable.$inferSelect;

type Props = {
  businessId: string;
  agent: AgentWithInstructions;
  peerAgents: Peer[];
  platformSystemRoles: PlatformSystemRole[];
};

function readSelectedImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Read failed"));
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}


export function AgentSettingsForm({
  businessId,
  agent,
  peerAgents,
  platformSystemRoles,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identity
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [systemRoleId, setSystemRoleId] = useState(agent.systemRoleId ?? "");
  const [reportsToAgentId, setReportsToAgentId] = useState<string>(agent.reportsToAgentId ?? "");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [pickedObjectUrl, setPickedObjectUrl] = useState<string | null>(null);
  const [clearPersistedAvatar, setClearPersistedAvatar] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<AgentPlatformIconId | null>(() =>
    agent.iconKey && isAgentPlatformIconId(agent.iconKey) ? agent.iconKey : null,
  );
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Cursor runtime (wired to DB)
  const [cursorModelId, setCursorModelId] = useState(agent.cursorModelId ?? "auto");
  const [cursorThinkingEffort, setCursorThinkingEffort] = useState(
    agent.cursorThinkingEffort ?? "auto",
  );
  const [heartbeatPromotionCap, setHeartbeatPromotionCap] = useState(
    String(agent.heartbeatPromotionCap ?? 3),
  );

  // Adapter is UI-only for now (Hermes/Multi post-MVP).
  const [adapter, setAdapter] = useState<AgentAdapterId>("cursor_cli");

  // Permissions (UI-only stubs)
  const [permissions, setPermissions] = useState<AgentSettingsPermissionsState>({
    createAgents: false,
    assignTasks: false,
    manageProjects: false,
    assignIssues: false,
    manageTeam: false,
  });

  const peers = peerAgents.filter((p) => p.id !== agent.id);

  const selectedSystemRole = platformSystemRoles.find((r) => r.id === systemRoleId);
  const showHeartbeatCap = selectedSystemRole?.runsHeartbeat === true;

  useEffect(() => {
    setSystemRoleId(agent.systemRoleId ?? "");
    setCursorModelId(agent.cursorModelId ?? "auto");
    setCursorThinkingEffort(agent.cursorThinkingEffort ?? "auto");
    const savedRoleRunsHeartbeat =
      platformSystemRoles.find((r) => r.id === (agent.systemRoleId ?? ""))?.runsHeartbeat === true;
    setHeartbeatPromotionCap(
      savedRoleRunsHeartbeat
        ? String(agent.heartbeatPromotionCap ?? HEARTBEAT_PROMOTION_CAP_DEFAULT)
        : String(HEARTBEAT_PROMOTION_CAP_DEFAULT),
    );
  }, [
    agent.id,
    agent.systemRoleId,
    agent.cursorModelId,
    agent.cursorThinkingEffort,
    agent.heartbeatPromotionCap,
    platformSystemRoles,
  ]);

  useEffect(() => {
    if (!showHeartbeatCap) {
      setHeartbeatPromotionCap(String(HEARTBEAT_PROMOTION_CAP_DEFAULT));
    }
  }, [showHeartbeatCap]);

  useEffect(() => {
    setSelectedIcon(agent.iconKey && isAgentPlatformIconId(agent.iconKey) ? agent.iconKey : null);
    setPickedFile(null);
    setClearPersistedAvatar(false);
    setPickedObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [agent.id, agent.iconKey, agent.avatarUrl]);

  const rawUploadCeilBytes = maxAvatarUploadFileBytes();

  const previewAvatarUrl =
    pickedObjectUrl ??
    (!clearPersistedAvatar ? agent.avatarUrl ?? null
    : null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        let nextAvatar: string | null | undefined = undefined;
        if (pickedFile) {
          nextAvatar = await readSelectedImageAsDataUrl(pickedFile);
          try {
            assertValidAgentAvatarUrl(nextAvatar);
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "Avatar did not pass validation.";
            toast.error(msg);
            setError(msg);
            return;
          }
        } else if (clearPersistedAvatar) {
          nextAvatar = null;
        }

        await updateAgent(agent.id, {
          name,
          role,
          reportsToAgentId: reportsToAgentId || null,
          systemRoleId: systemRoleId || null,
          cursorModelId,
          cursorThinkingEffort,
          heartbeatPromotionCap: showHeartbeatCap
            ? parseHeartbeatPromotionCapFromForm(heartbeatPromotionCap)
            : HEARTBEAT_PROMOTION_CAP_DEFAULT,
          ...(nextAvatar !== undefined ? { avatarUrl: nextAvatar } : {}),
          iconKey: selectedIcon,
        });

        setPickedFile(null);
        setClearPersistedAvatar(false);
        setPickedObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });

        toast.success("Settings saved.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${agent.name}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteAgent(agent.id);
        router.push(`/dashboard/agents?businessId=${encodeURIComponent(businessId)}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-0">

      {/* ── Identity ──────────────────────────────────────────────── */}
      <p className="section-label mb-4">Identity</p>

      {/* Avatar */}
      <div className="mb-5 flex items-center gap-4">
        {/* Avatar preview */}
        <AgentRosterAvatar
          name={name || "Agent"}
          avatarUrl={previewAvatarUrl}
          iconKey={selectedIcon}
          sizeClasses="size-14 shrink-0 rounded-xl font-mono text-[15px]"
          className="border border-white/[0.07]"
        />

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowIconPicker((v) => !v)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors",
                showIconPicker
                  ? "border-white/[0.16] bg-white/[0.05] text-foreground"
                  : "border-border text-muted-foreground hover:border-white/[0.16] hover:text-foreground",
              )}
            >
              Choose icon
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-white/[0.16] hover:text-foreground"
            >
              <Upload className="size-3" />
              Upload
            </button>
            {(previewAvatarUrl ?? selectedIcon) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedIcon(null);
                  setClearPersistedAvatar(true);
                  setPickedFile(null);
                  setPickedObjectUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                  });
                  setShowIconPicker(false);
                }}
                className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1.5 text-[11px] text-muted-foreground/40 transition-colors hover:text-muted-foreground"
                title="Clear icon and uploaded photo"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/40">
            PNG, JPEG, GIF or WebP · max ~{(rawUploadCeilBytes / (1024 * 1024)).toFixed(1)} MB file (stored data URL ≤
            2 MB UTF-8)
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > rawUploadCeilBytes) {
              toast.error(
                `Choose a smaller image (max ~${(rawUploadCeilBytes / (1024 * 1024)).toFixed(1)} MB file before encoding).`,
              );
              e.target.value = "";
              return;
            }
            setClearPersistedAvatar(false);
            setPickedFile(file);
            setPickedObjectUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return URL.createObjectURL(file);
            });
            e.target.value = "";
          }}
        />
      </div>

      {/* Icon picker */}
      {showIconPicker && (
        <div className="mb-4 rounded-md border border-border bg-white/[0.02] p-3">
          <div className="grid grid-cols-10 gap-1">
            {AGENT_PLATFORM_ICON_IDS.map((id) => {
              const IconComp = AGENT_PLATFORM_ICONS[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSelectedIcon(id);
                    setShowIconPicker(false);
                  }}
                  className={cn(
                    "flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors",
                    selectedIcon === id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground/50 hover:bg-white/[0.06] hover:text-foreground",
                  )}
                  aria-label={`Icon ${id}`}
                >
                  <IconComp className="size-4" aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <FieldInput
          id="agent-name"
          label="Name"
          value={name}
          onChange={setName}
          placeholder="Agent name"
          testId="agent-name"
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="agent-role" className="section-label flex items-center gap-1">
            Agent role
            <FieldHint text="Free-text job title for this agent. Does not change runner behavior." />
          </label>
          <input
            id="agent-role"
            data-testid="agent-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Senior Developer"
            className={cn(
              "h-9 w-full rounded-md border border-border bg-transparent",
              "px-3 text-[13px] text-foreground placeholder:text-muted-foreground/30",
              "outline-none transition-colors focus:border-white/[0.18]",
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* System role */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="system-role" className="section-label">System role</label>
          <CustomSelect
            id="system-role"
            value={systemRoleId}
            onChange={setSystemRoleId}
            options={[
              { id: "", label: "— Choose platform role —" },
              ...platformSystemRoles.map((r) => ({ id: r.id, label: r.name })),
            ]}
          />
          <p className="text-[11px] text-muted-foreground/35 leading-snug">
            {platformSystemRoles.find((r) => r.id === systemRoleId)?.description ??
              "Platform-defined behaviour layer (prompt + behaviour). Agents must assign a role before the local runner executes webhooks."}
          </p>
          {platformSystemRoles.find((r) => r.id === systemRoleId)?.includeBusinessContext && (
            <p className="text-[11px] text-emerald-500/70 leading-snug">
              Business-scope memory will be appended for this role when orchestration runs.
            </p>
          )}
        </div>

        {/* Reports to */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="agent-reports-to" className="section-label">Reports to</label>
          <CustomSelect
            id="agent-reports-to"
            data-testid="agent-reports-to"
            value={reportsToAgentId}
            onChange={setReportsToAgentId}
            options={[
              { id: "", label: "— None —" },
              ...peers
                .filter((p) => p.id !== agent.id && !p.isPlatformDefault)
                .map((p) => ({ id: p.id, label: p.name })),
            ]}
          />
        </div>
      </div>

      <AgentSettingsAdapterRunPolicySections
        adapter={adapter}
        setAdapter={setAdapter}
        cursorModelId={cursorModelId}
        setCursorModelId={setCursorModelId}
        cursorThinkingEffort={cursorThinkingEffort}
        setCursorThinkingEffort={setCursorThinkingEffort}
        heartbeatPromotionCap={heartbeatPromotionCap}
        setHeartbeatPromotionCap={setHeartbeatPromotionCap}
        showHeartbeatCap={showHeartbeatCap}
      />

      <AgentSettingsPermissionsSection
        permissions={permissions}
        setPermissions={setPermissions}
      />

      {/* ── Actions ───────────────────────────────────────────────── */}
      {error && (
        <p className="mb-3 text-[12px] text-destructive" role="alert">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <PrimaryButton
          type="button"
          disabled={pending}
          loading={pending}
          onClick={handleSave}
          icon={Save}
          size="md"
          data-testid="agent-save"
        >
          {pending ? "Saving…" : "Save changes"}
        </PrimaryButton>
      </div>

      {/* ── Danger zone ───────────────────────────────────────────── */}
      {!agent.isPlatformDefault ? (
        <div className="mt-8 border-t border-white/[0.06] pt-5">
          <p className="section-label mb-3 text-destructive/60">Danger zone</p>
          <div className="flex items-center justify-between rounded-md border border-destructive/20 px-4 py-3">
            <div>
              <p className="text-[13px] font-medium text-foreground">Delete this agent</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                Permanently remove this agent and all associated data. Cannot be undone.
              </p>
            </div>
            <button
              type="button"
              data-testid="agent-delete"
              disabled={pending}
              onClick={handleDelete}
              className={cn(
                "flex cursor-pointer items-center rounded-md border border-destructive/30 px-3 py-1.5",
                "text-[12px] font-medium text-destructive/70 transition-colors",
                "hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              Delete agent
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
