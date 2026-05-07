# Heartbeat (Task 2.1)

Server-side prompt assembly and **`runHeartbeat(agentId)`**, which calls **`@cursor/sdk`** with the business `local_path` as the local agent `cwd`.

## Files

| File | Role |
|------|------|
| `prompt-builder.ts` | `buildHeartbeatPrompt(agentId)` loads agent documents, archetype addendum, recent business memory, tasks, task logs, approvals; `formatHeartbeatPrompt` is the pure formatter used in tests. |
| `actions.ts` | `runHeartbeat` — auth; **lead agents** (`system_roles.runs_heartbeat`) enqueue `lead_heartbeat` for the runner instead of running SDK in-request; others use API key + SDK + `orchestration_events` row with `type: heartbeat_run`. |

## Notes

- Neon HTTP has no `db.transaction()`; orchestration insert is a separate write after the SDK run.
- `@cursor/sdk` is listed in `serverExternalPackages` in `next.config.ts` so Next does not bundle the native runtime graph.
- Requires `ENCRYPTION_KEY`, a saved Cursor API key in **Settings** (encrypted in `user_settings`), and a non-empty **workspace path** on the business record.
