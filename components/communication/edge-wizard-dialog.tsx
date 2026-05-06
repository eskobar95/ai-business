"use client";

import { createEdge } from "@/lib/communication/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useState, useTransition } from "react";

/** Managed intents (subset; extend via registry in post-MVP). */
export const MANAGED_ALLOWED_INTENTS = [
  "task_assignment",
  "status_update",
  "blocker_report",
  "design_brief",
  "requirements_handoff",
  "pr_review_request",
  "security_finding",
  "deploy_request",
] as const;

/** Managed artifact kinds for edges. */
export const MANAGED_ARTIFACT_KINDS = [
  "task",
  "pr",
  "design_brief",
  "requirements_doc",
  "test_plan",
  "security_report",
  "deploy_config",
  "intelligence_card",
] as const;

type Direction = "one_way" | "bidirectional";

type WizardState = {
  step: 1 | 2 | 3 | 4 | 5;
  direction: Direction;
  intents: Set<string>;
  artifacts: Set<string>;
  quotaPerHour: string;
  quotaMode: "warn_only" | "enforce";
  requiresHumanAck: boolean;
};

type WizardAction =
  | { type: "setStep"; step: WizardState["step"] }
  | { type: "setDirection"; direction: Direction }
  | { type: "toggleIntent"; id: string }
  | { type: "toggleArtifact"; id: string }
  | { type: "setQuota"; raw: string }
  | { type: "toggleQuotaMode" }
  | { type: "toggleHumanAck" }
  | { type: "hardReset" };

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "hardReset":
      return {
        step: 1,
        direction: "one_way",
        intents: new Set(),
        artifacts: new Set(),
        quotaPerHour: "",
        quotaMode: "warn_only",
        requiresHumanAck: false,
      };
    case "setStep":
      return { ...state, step: action.step };
    case "setDirection":
      return { ...state, direction: action.direction };
    case "toggleIntent": {
      const next = new Set(state.intents);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, intents: next };
    }
    case "toggleArtifact": {
      const next = new Set(state.artifacts);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, artifacts: next };
    }
    case "setQuota":
      return { ...state, quotaPerHour: action.raw };
    case "toggleQuotaMode":
      return {
        ...state,
        quotaMode: state.quotaMode === "warn_only" ? "enforce" : "warn_only",
      };
    case "toggleHumanAck":
      return { ...state, requiresHumanAck: !state.requiresHumanAck };
    default:
      return state;
  }
}

function initialWizardState(): WizardState {
  return {
    step: 1,
    direction: "one_way",
    intents: new Set(),
    artifacts: new Set(),
    quotaPerHour: "",
    quotaMode: "warn_only",
    requiresHumanAck: false,
  };
}

function ChipToggle({
  id,
  label,
  selected,
  onToggle,
  disabled,
}: {
  id: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      data-testid={`edge-wizard-chip-${id}`}
      onClick={onToggle}
      className={cn(
        "rounded-md border px-2.5 py-1 text-[11px] font-medium tracking-tight transition-colors",
        selected ?
          "border-primary/55 bg-primary/15 text-foreground"
        : "border-border bg-card/40 text-muted-foreground hover:bg-card/60",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {label}
    </button>
  );
}

export type EdgeWizardDialogProps = {
  open: boolean;
  businessId: string;
  fromRole: string;
  toRole: string;
  fromLabel: string;
  toLabel: string;
  onClose: () => void;
};

export function EdgeWizardDialog({
  open,
  businessId,
  fromRole,
  toRole,
  fromLabel,
  toLabel,
  onClose,
}: EdgeWizardDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, dispatch] = useReducer(reducer, undefined, initialWizardState);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      dispatch({ type: "hardReset" });
      setError(null);
    }
  }, [open, fromRole, toRole]);

  const validateStep = useCallback((): boolean => {
    setError(null);
    if (state.step === 2 && state.intents.size === 0) {
      setError("Select at least one allowed intent.");
      return false;
    }
    const q = state.quotaPerHour.trim();
    if (state.step === 4 && q !== "") {
      const n = Number.parseInt(q, 10);
      if (Number.isNaN(n) || n < 1) {
        setError("quota_per_hour must be a positive integer or empty.");
        return false;
      }
    }
    return true;
  }, [state.step, state.intents.size, state.quotaPerHour]);

  const handleNext = useCallback(() => {
    if (!validateStep()) return;
    dispatch({ type: "setStep", step: Math.min(5, state.step + 1) as WizardState["step"] });
  }, [state.step, validateStep]);

  const handleBack = useCallback(() => {
    setError(null);
    dispatch({ type: "setStep", step: Math.max(1, state.step - 1) as WizardState["step"] });
  }, [state.step]);

  const submit = useCallback(() => {
    setError(null);
    const intents = [...state.intents];
    if (intents.length === 0) {
      setError("Select at least one allowed intent.");
      return;
    }
    const quotaRaw = state.quotaPerHour.trim();
    const quota =
      quotaRaw === "" ? null : Number.parseInt(quotaRaw, 10);
    if (quotaRaw !== "" && (quota === null || Number.isNaN(quota) || quota < 1)) {
      setError("quota_per_hour must be a positive integer or empty.");
      return;
    }

    startTransition(async () => {
      try {
        await createEdge(businessId, {
          fromRole,
          toRole,
          direction: state.direction,
          allowedIntents: intents,
          allowedArtifacts: [...state.artifacts],
          requiresHumanAck: state.requiresHumanAck,
          quotaPerHour: quota,
          quotaMode: state.quotaMode,
        });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }, [
    businessId,
    fromRole,
    onClose,
    router,
    state.artifacts,
    state.direction,
    state.intents,
    state.quotaMode,
    state.quotaPerHour,
    state.requiresHumanAck,
    toRole,
  ]);

  if (!open) return null;

  const directionSummary =
    state.direction === "one_way" ?
      `${fromLabel} → ${toLabel}`
    : `${fromLabel} ↔ ${toLabel}`;

  const title = (
    <>
      Connect <span className="text-foreground font-semibold">{fromLabel}</span> to{" "}
      <span className="text-foreground font-semibold">{toLabel}</span>
    </>
  );

  return (
    <div
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edge-wizard-title"
      data-testid="edge-wizard-dialog"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        className="border-border bg-background max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-border flex items-start justify-between border-b px-5 py-4">
          <div>
            <h2 id="edge-wizard-title" className="text-foreground text-sm font-semibold">
              Edge wizard · Step {state.step} of 5
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">{title}</p>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-xs"
            onClick={onClose}
            disabled={pending}
            aria-label="Close dialog"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4">
          {state.step === 1 ?
            <div className="space-y-3">
              <p className="text-muted-foreground text-xs">Choose direction for consult traffic.</p>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="wiz-dir"
                  checked={state.direction === "one_way"}
                  onChange={() => dispatch({ type: "setDirection", direction: "one_way" })}
                  disabled={pending}
                />
                One-way ({fromRole} → {toRole})
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="wiz-dir"
                  checked={state.direction === "bidirectional"}
                  onChange={() => dispatch({ type: "setDirection", direction: "bidirectional" })}
                  disabled={pending}
                />
                Bidirectional (both directions allowed)
              </label>
            </div>
          : null}

          {state.step === 2 ?
            <div className="flex flex-wrap gap-1.5">
              {MANAGED_ALLOWED_INTENTS.map((id) => (
                <ChipToggle
                  key={id}
                  id={id}
                  label={id.replace(/_/g, " ")}
                  selected={state.intents.has(id)}
                  onToggle={() => dispatch({ type: "toggleIntent", id })}
                  disabled={pending}
                />
              ))}
            </div>
          : null}

          {state.step === 3 ?
            <div className="flex flex-wrap gap-1.5">
              {MANAGED_ARTIFACT_KINDS.map((id) => (
                <ChipToggle
                  key={id}
                  id={id}
                  label={id.replace(/_/g, " ")}
                  selected={state.artifacts.has(id)}
                  onToggle={() => dispatch({ type: "toggleArtifact", id })}
                  disabled={pending}
                />
              ))}
            </div>
          : null}

          {state.step === 4 ?
            <div className="space-y-3">
              <label className="text-muted-foreground flex flex-col gap-1 text-xs">
                Quota per hour (optional)
                <input
                  type="number"
                  min={1}
                  className="border-input bg-background text-foreground h-9 rounded-md border px-3 text-sm"
                  value={state.quotaPerHour}
                  onChange={(e) => dispatch({ type: "setQuota", raw: e.target.value })}
                  disabled={pending}
                  placeholder="Leave empty for no quota"
                  data-testid="edge-wizard-quota"
                />
              </label>
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={state.quotaMode === "enforce"}
                  onChange={() => dispatch({ type: "toggleQuotaMode" })}
                  disabled={pending}
                  data-testid="edge-wizard-quota-enforce"
                />
                Enforce quota (otherwise warn_only)
              </label>
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={state.requiresHumanAck}
                  onChange={() => dispatch({ type: "toggleHumanAck" })}
                  disabled={pending}
                  data-testid="edge-wizard-human-ack"
                />
                Requires human acknowledgement before consult succeeds
              </label>
            </div>
          : null}

          {state.step === 5 ?
            <div className="text-muted-foreground space-y-2 text-xs">
              <p>
                <span className="text-foreground font-medium">Direction:</span> {directionSummary}
              </p>
              <p>
                <span className="text-foreground font-medium">Intents:</span>{" "}
                {[...state.intents].join(", ") || "—"}
              </p>
              <p>
                <span className="text-foreground font-medium">Artifacts:</span>{" "}
                {[...state.artifacts].join(", ") || "(none)"}
              </p>
              <p>
                <span className="text-foreground font-medium">Quota:</span>{" "}
                {state.quotaPerHour.trim() === "" ?
                  "None"
                : `${state.quotaPerHour}/h (${state.quotaMode})`}
              </p>
              <p>
                <span className="text-foreground font-medium">Human ack:</span>{" "}
                {state.requiresHumanAck ? "Yes" : "No"}
              </p>
            </div>
          : null}

          {error ?
            <p className="text-destructive mt-3 text-sm" data-testid="edge-wizard-error">
              {error}
            </p>
          : null}

          <div className="mt-5 flex justify-between gap-2">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClose}>
                Cancel
              </Button>
              {state.step > 1 ?
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleBack}>
                  Back
                </Button>
              : null}
            </div>
            {state.step < 5 ?
              <Button type="button" size="sm" disabled={pending} onClick={handleNext}>
                Next
              </Button>
            : <Button type="button" size="sm" disabled={pending} onClick={() => void submit()}>
                Save edge
              </Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
