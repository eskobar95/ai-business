# Agent UI components

- **`agent-card.tsx`** — Roster card linking to edit; wraps live status in `Suspense` for `AgentStatusBadge`.
- **`agent-status-badge.tsx`** — Async server component; reads `getAgentStatus(agentId)` and renders a color-coded badge.
- **`agent-settings-form.tsx`** — Client form for agent identity, Cursor runtime fields, adapter toggle (UI-only for non-Cursor adapters), run policy (promotion cap when applicable), permissions stub, save/delete; exports `AgentSettingsForm`.
- **`agent-settings-form-fields-part.tsx`** — Shared form primitives: `FieldInput`, `FieldSelect`, `SectionDivider` (used by the main form and permissions section).
- **`agent-settings-form-permissions-part.tsx`** — Permissions block: `AgentSettingsPermissionsSection`, `AgentSettingsPermissionsState`.
- **`agent-settings-form-adapter-run-policy-part.tsx`** — Adapter type toggle, Cursor model / thinking-effort (DB-backed options), heartbeat promotion cap when system role runs heartbeat: `AgentSettingsAdapterRunPolicySections`, type `AgentAdapterId`.
