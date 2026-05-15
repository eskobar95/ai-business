# Dashboard routes

Business-scoped UI under `/dashboard/*`. Pages use `resolveBusinessIdParam` from `lib/dashboard/business-scope.ts` with `?businessId=` so tenants stay authorized.

| Path | Purpose |
|------|---------|
| `page.tsx` | Main dashboard — mission overview, empty state with Conductor link when no missions exist |
| `agents/` | Agent roster; `[agentId]` detail + chat; `new/` create form. Conductor shown with "Platform" badge |
| `approvals/` | Pending approval queue; `[approvalId]` detail with EM decompose button on approved PO briefs |
| `missions/` | Mission list (empty state → wizard CTA + Conductor nudge); `new/` 4-step wizard; `[missionId]` detail with sprint list + PO brief button |
| `tasks/` | Kanban board; supports `?teamId=` filter for team-scoped views; empty state links to missions + Conductor |
| `teams/` | Team management with lead agent assignment |
| `settings/` | Business settings; `?section=` tabs: account, business, workspace, integrations (GitHub), mcp, webhooks |
| `onboarding/` | Create **another** business (quick form). First-time users belong on `/onboarding` instead |
| `approvals/` | Pending approval queue + `[approvalId]` detail |
| `skills/` | Skills library: ZIP/folder/GitHub install, agent assignment |
| `notion/` | Notion MCP credential form per agent + recent sync table |
| `webhooks/` | `webhook_deliveries` log for the selected business |
| `communication/` | Agent communication edges and message log |
