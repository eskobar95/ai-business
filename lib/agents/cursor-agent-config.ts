export const CURSOR_MODEL_OPTIONS = [
  { value: "auto", label: "Auto (Cursor vælger)" },
  { value: "inherit", label: "Inherit fra workspace" },
  { value: "composer-2", label: "Composer 2 (platform default)" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { value: "claude-opus-4", label: "Claude Opus 4" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

export const CURSOR_EFFORT_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "inherit", label: "Inherit fra workspace" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export type CursorModelValue = (typeof CURSOR_MODEL_OPTIONS)[number]["value"];
export type CursorEffortValue = (typeof CURSOR_EFFORT_OPTIONS)[number]["value"];

export function isValidCursorModel(v: string): v is CursorModelValue {
  return CURSOR_MODEL_OPTIONS.some((o) => o.value === v);
}

export function isValidCursorEffort(v: string): v is CursorEffortValue {
  return CURSOR_EFFORT_OPTIONS.some((o) => o.value === v);
}

/** Validates Cursor-related fields before persisting on `agents` (used by `updateAgent`). */
export function assertValidAgentCursorPatchFields(patch: {
  cursorModelId?: string;
  cursorThinkingEffort?: string;
  heartbeatPromotionCap?: number;
}): void {
  if (patch.cursorModelId !== undefined && !isValidCursorModel(patch.cursorModelId)) {
    throw new Error(`Invalid cursorModelId: ${patch.cursorModelId}`);
  }
  if (
    patch.cursorThinkingEffort !== undefined &&
    !isValidCursorEffort(patch.cursorThinkingEffort)
  ) {
    throw new Error(`Invalid cursorThinkingEffort: ${patch.cursorThinkingEffort}`);
  }
  if (patch.heartbeatPromotionCap !== undefined) {
    if (!Number.isInteger(patch.heartbeatPromotionCap) || patch.heartbeatPromotionCap < 1) {
      throw new Error("heartbeatPromotionCap must be a positive integer");
    }
  }
}
