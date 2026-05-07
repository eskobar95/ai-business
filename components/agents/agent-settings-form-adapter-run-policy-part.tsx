"use client";

import {
  FieldSelect,
  SectionDivider,
} from "@/components/agents/agent-settings-form-fields-part";
import { FieldHint } from "@/components/settings/field-hint";
import {
  CURSOR_EFFORT_OPTIONS,
  CURSOR_MODEL_OPTIONS,
  HEARTBEAT_PROMOTION_CAP_MAX,
  HEARTBEAT_PROMOTION_CAP_MIN,
} from "@/lib/agents/cursor-agent-config";
import { cn } from "@/lib/utils";

const ADAPTERS = [
  { id: "cursor_cli", label: "Cursor CLI" },
  { id: "hermes", label: "Hermes Agent" },
  { id: "multi", label: "Multi-agent" },
] as const;

export type AgentAdapterId = (typeof ADAPTERS)[number]["id"];

const MODEL_SELECT_OPTIONS = CURSOR_MODEL_OPTIONS.map((o) => ({ id: o.value, label: o.label }));
const EFFORT_SELECT_OPTIONS = CURSOR_EFFORT_OPTIONS.map((o) => ({ id: o.value, label: o.label }));

type Props = {
  adapter: AgentAdapterId;
  setAdapter: (id: AgentAdapterId) => void;
  cursorModelId: string;
  setCursorModelId: (v: string) => void;
  cursorThinkingEffort: string;
  setCursorThinkingEffort: (v: string) => void;
  heartbeatPromotionCap: string;
  setHeartbeatPromotionCap: (v: string) => void;
  /** Show promotion cap only when the selected system role has `runsHeartbeat=true`. */
  showHeartbeatCap: boolean;
};

export function AgentSettingsAdapterRunPolicySections({
  adapter,
  setAdapter,
  cursorModelId,
  setCursorModelId,
  cursorThinkingEffort,
  setCursorThinkingEffort,
  heartbeatPromotionCap,
  setHeartbeatPromotionCap,
  showHeartbeatCap,
}: Props) {
  return (
    <>
      <SectionDivider label="Adapter" />

      <div className="mb-4 flex flex-col gap-1.5">
        <p className="section-label">Adapter type</p>
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          {ADAPTERS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAdapter(a.id)}
              className={cn(
                "flex-1 cursor-pointer px-4 py-2 text-[12px] font-medium transition-colors",
                i > 0 ? "border-l border-white/[0.07]" : "",
                adapter === a.id
                  ? "bg-white/[0.08] text-foreground"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
        {adapter === "multi" && (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground/40">
            The agent selects the best adapter per task automatically.
          </p>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <FieldSelect
          id="model"
          label="Model"
          value={cursorModelId}
          onChange={setCursorModelId}
          options={MODEL_SELECT_OPTIONS}
        />
        <FieldSelect
          id="thinking-effort"
          label="Thinking effort"
          value={cursorThinkingEffort}
          onChange={setCursorThinkingEffort}
          options={EFFORT_SELECT_OPTIONS}
        />
      </div>

      <SectionDivider label="Run Policy" />

      {showHeartbeatCap && (
        <div className="mb-4">
          <p className="section-label mb-2 flex items-center gap-1">
            Promotion cap per heartbeat
            <FieldHint text="Max backlog→todo promotions per heartbeat tick for this agent. Default: 3. Range matches server validation." />
          </p>
          <input
            type="number"
            min={HEARTBEAT_PROMOTION_CAP_MIN}
            max={HEARTBEAT_PROMOTION_CAP_MAX}
            value={heartbeatPromotionCap}
            onChange={(e) => setHeartbeatPromotionCap(e.target.value)}
            className="h-8 w-24 rounded-md border border-border bg-transparent px-3 text-[13px] text-foreground outline-none transition-colors focus:border-white/[0.18]"
          />
        </div>
      )}
    </>
  );
}
