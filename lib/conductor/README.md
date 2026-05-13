# Conductor (platform default agent)

These modules are intended for **server-only** use (database and filesystem); import them only from Route Handlers, Server Actions, or other server modules.

| File | Purpose |
|------|---------|
| `conductor-instructions.md` | Base instruction template with `[PLACEHOLDER]` tokens; copied into the Conductor `agent_documents` soul row on first seed. |
| `conductor-context.ts` | Loads business soul memory, roster, projects (missions), and pending approvals; fills template placeholders at runtime (used by heartbeat prompt assembly). |
| `seed-conductor.ts` | `seedConductorAgent(businessId)` — inserts Conductor if missing (`ON CONFLICT DO NOTHING` on `(business_id, slug)`), ensures default documents, and sets `is_platform_default`. |

Call `seedConductorAgent` from business creation and optionally as a one-off migration for existing businesses.
