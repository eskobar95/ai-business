/**
 * Single source of truth for workspace-level Cursor defaults (model + thinking effort).
 * Server actions validate against the same value sets the settings UI offers.
 */

export const WORKSPACE_DEFAULT_CURSOR_SELECT_SENTINEL = "__platform_default__" as const;

const WORKSPACE_CURSOR_MODEL_OPTIONS = [
  { value: "auto", label: "Auto (Cursor picks)" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { value: "claude-opus-4", label: "Claude Opus 4" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

const WORKSPACE_CURSOR_THINKING_EFFORT_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

const MODEL_VALUE_SET = new Set<string>(
  WORKSPACE_CURSOR_MODEL_OPTIONS.map((o) => o.value),
);
const EFFORT_VALUE_SET = new Set<string>(
  WORKSPACE_CURSOR_THINKING_EFFORT_OPTIONS.map((o) => o.value),
);

/** Radix Select items: platform default sentinel + allowlisted model ids. */
export function workspaceCursorModelSelectItems(): { value: string; label: string }[] {
  return [
    { value: WORKSPACE_DEFAULT_CURSOR_SELECT_SENTINEL, label: "Platform default (composer-2)" },
    ...WORKSPACE_CURSOR_MODEL_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
}

/** Radix Select items: platform default sentinel + allowlisted effort values. */
export function workspaceCursorThinkingEffortSelectItems(): { value: string; label: string }[] {
  return [
    { value: WORKSPACE_DEFAULT_CURSOR_SELECT_SENTINEL, label: "Platform default" },
    ...WORKSPACE_CURSOR_THINKING_EFFORT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
}

export function isAllowedWorkspaceCursorModelId(id: string): boolean {
  return MODEL_VALUE_SET.has(id);
}

export function isAllowedWorkspaceThinkingEffort(effort: string): boolean {
  return EFFORT_VALUE_SET.has(effort);
}
