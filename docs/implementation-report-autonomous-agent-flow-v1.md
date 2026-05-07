# Implementation Report — Autonomous Agent Flow v1

**Date:** 2026-05-07  
**Status:** ✅ Complete — all 7 streams merged, 82 test files, 358 tests passing  
**PRD reference:** `docs/prd-autonomous-agent-flow-v1.md`  
**Task plan:** `docs/tasks-autonomous-agent-flow-v1.md`

---

## Summary

This report documents the full implementation of the **Autonomous Agent Flow v1** — the orchestration layer that enables AI agents on the platform to operate independently without constant human intervention.

The system now supports:
- **Automatic task promotion** from `backlog` → `todo` when readiness gates are met
- **Auto-triggered worker agents** the moment a task enters `todo` status
- **Lead agent heartbeat scheduling** that periodically evaluates the backlog and orchestrates promotions
- **GitHub PR status gates** that block task promotion until a dependency PR is merged
- **Comment routing** to the correct agent based on @mention rules
- **Configurable Cursor runtime** (model, thinking effort) per agent and per business
- **Per-agent mutex and business-level parallel caps** in the runner

---

## Streams Delivered

### S1 — Data Model & Migrations (PR #20)

**Branch:** `feat/autonomous-datamodel`

Extended the database schema to support the full autonomous flow.

**Schema changes (`db/schema.ts`):**

| Table | New columns |
|-------|-------------|
| `tasks` | `dependencyTaskId`, `githubPrNumber`, `githubRepoInstallationId`, `githubPrStatus`, `prMergedToIntegration`, `gatesLockedAt` |
| `businesses` | `integrationBranch`, `releaseBranch`, `maxParallelRuns`, `defaultCursorModelId`, `defaultCursorThinkingEffort` |
| `agents` | `cursorModelId`, `cursorThinkingEffort`, `cursorRuntimeProfile`, `heartbeatPromotionCap` |
| `system_roles` | `requiresGitWorkspace`, `mayPromoteBacklogToTodo`, `requiresPrMergeGate`, `runsHeartbeat` |
| `taskStatusEnum` | Added `"todo"` value |

**Seed script:** `scripts/seed-system-roles.ts` — upserts system roles with correct flags for `developer`, `analyst`, `researcher`, `ux_designer`, `engineering_manager`, `lead`.

---

### S2 — Workspace Settings UI (PR #21)

**Branch:** `feat/workspace-settings`

Added business-level configuration UI accessible from workspace settings.

**New settings sections:**
- **Git branches** — `integrationBranch` (required for execution) and `releaseBranch` (human-gated)
- **Business memory editor** — markdown editor for the business soul/context injected into every agent run
- **Parallel run cap** — optional limit on concurrent agent runs per business (0 = unlimited)
- **Cursor defaults** — fallback model and thinking effort for agents that use `inherit`

**New Server Actions (`lib/settings/`):**
- `updateBusinessBranchSettings` — validates branch names, rejects illegal characters
- `updateBusinessParallelSettings` — validates positive integer or null
- `updateBusinessCursorDefaults` — validates against allowlisted model/effort values
- `updateMemoryContent` — optimistic-lock update for business memory markdown

---

### S3 — GitHub Webhooks (PR #24)

**Branch:** `feat/github-webhooks`

Implemented a verified GitHub App webhook endpoint for real-time PR status tracking.

**New endpoint:** `app/api/webhooks/[businessId]/receive/route.ts`
- HMAC-SHA256 signature verification (constant-time compare)
- Idempotency via `webhook_deliveries` table (deduplicates on `idempotencyKey`)
- `business_id` made nullable on `webhook_deliveries` to support installation-level events

**PR status handler (`lib/github/pr-webhook-handler.ts`):**
- Parses `pull_request` webhook events (opened, synchronize, closed, converted_to_draft, review_requested)
- Maps PR state to `githubPrStatus` on matching tasks
- Sets `prMergedToIntegration = true` when a PR is merged into `business.integrationBranch`
- GIN index on `github_installations.repos` for fast JSONB lookup

**UI:** `components/tasks/task-pr-badge.tsx` — shows live PR status badge on task cards.

---

### S4 — Task Lifecycle UI & Actions (PR #23)

**Branch:** `feat/task-lifecycle`

Implemented the `todo` status, dependency picker, PR link, and gate status in the task UI.

**New task status flow:**
```
backlog → todo → in_progress → in_review → done
              ↑
         (blocked by gates)
```

**New Server Actions (`lib/tasks/actions.ts`):**
- `promoteTaskToTodo` — RBAC-gated promotion; only agents/users with `mayPromoteBacklogToTodo` or lead access may promote
- `updateTaskDependency` — sets/clears `dependencyTaskId`
- `linkTaskToPr` — links `githubPrNumber` and `githubRepoInstallationId`

**UI additions:**
- Dependency picker on task detail view
- PR number input with live badge
- Gate status indicator (shows what is blocking promotion)

---

### S5 — Runner Core (PR #27, combined with TX1)

**Branch:** `feat/cursor-runtime-and-runner-s5`

Hardened the runner with mutex, git-preflight, Cursor config resolver, and readiness gate.

**`runner/poll.ts` — per-agent mutex and business parallel cap:**
```typescript
const agentInFlight = new Set<string>();       // blocks same agent running twice
const businessInFlight = new Map<string, number>(); // enforces maxParallelRuns
```
- FIFO ordering preserved — skipped events stay pending for next tick
- Business parallel cap read from DB with per-tick cache to minimize queries

**`runner/git-preflight.ts` — git discipline before every code-agent run:**
1. `git fetch origin`
2. `git status --porcelain` — aborts with error on dirty tree
3. `git checkout <integrationBranch> && git pull --ff-only`
4. Optional PR-branch worktree setup for code-working agents

Applied only when `system_role.requiresGitWorkspace === true`.

**`runner/cursor-config-resolver.ts` — auto/inherit/concrete chain:**

| Agent value | Business value | Result |
|-------------|----------------|--------|
| `"auto"` | (any) | Nothing passed to SDK (Cursor chooses) |
| `"inherit"` | `"claude-sonnet-4"` | `"claude-sonnet-4"` |
| `"inherit"` | `"auto"` / null | Nothing passed to SDK |
| `"claude-opus-4"` | (any) | `"claude-opus-4"` |

**`runner/readiness-check.ts` — business readiness gate:**
- Throws with clear message if business has no memory or no `localPath`
- Called before every SDK invocation

**`runner/dispatch.ts`:**
- `mention_trigger` and `webhook_trigger` both handled
- `lead_heartbeat` stub inserted (real implementation in S7)
- Mention context prepended to prompt when `trigger === "comment_mention"`

---

### TX1 — Agent Settings (PR #27, combined with S5)

**New file:** `lib/agents/cursor-agent-config.ts`  
Shared constants for Cursor model and thinking effort options, with validators:
```typescript
CURSOR_MODEL_OPTIONS  // auto, inherit, composer-2, claude-sonnet-4, claude-opus-4, gpt-4.1, gemini-2.5-pro
CURSOR_EFFORT_OPTIONS // auto, inherit, low, medium, high
```

**`lib/agents/actions.ts` — `updateAgent` extended:**
- Accepts and persists `cursorModelId`, `cursorThinkingEffort`, `heartbeatPromotionCap`
- Validates against allowlists before writing to DB

**`components/agents/agent-settings-form.tsx`:**
- State wired from `agent.cursorModelId` / `agent.cursorThinkingEffort` / `agent.heartbeatPromotionCap` (no more hardcoded stubs)
- Heartbeat promotion cap field visible only when selected system role has `runsHeartbeat = true`
- Tooltips on **Agent Role** (free-text job title) vs **System Role** (runner behaviour flags)

---

### S6 — Trigger Logic (PR #26)

**Branch:** `feat/trigger-logic`

Implemented comment routing, gate evaluation, and auto-trigger from `todo` status.

**`lib/tasks/mention-trigger.ts` — rewritten as `routeCommentToAgents`:**

| Comment contains | Task has assignee | Action |
|-----------------|-------------------|--------|
| No `@mention` | Yes | Trigger assigned agent |
| No `@mention` | No | No-op |
| `@mention X` | Any | Trigger all matched agents |

Produces `webhook_trigger` events (replaces deprecated `mention_trigger` type).

**`lib/tasks/gate-evaluator.ts` — AND-gate evaluation:**
```typescript
dependency_ok = dependencyTaskId IS NULL || dependency.status === "done"
pr_ok         = githubPrNumber IS NULL   || prMergedToIntegration === true
ready         = dependency_ok && pr_ok
```
Returns `{ ready, dependencyOk, prOk, reasons[] }`.

**`lib/tasks/auto-trigger.ts` — idempotent auto-trigger:**
- Evaluates gates for any `todo`-status task
- Uses `gatesLockedAt` as optimistic lock guard — only triggers once per task
- Called from: `promoteTaskToTodo`, `updateTaskStatus` (when dep finishes), GitHub webhook handler (when PR merges)

**`scripts/cleanup-mention-triggers.ts`:**  
One-time script to mark stale `mention_trigger` pending events as failed (migrated to `webhook_trigger`).  
Run: `npm run db:cleanup-mention-triggers`

---

### S7 — Lead Heartbeat (PR #28)

**Branch:** `feat/lead-heartbeat`

The final stream — closes the fully autonomous loop. The lead agent now runs periodically without human intervention, evaluates the backlog, and promotes ready tasks.

**`runner/lead-heartbeat.ts` — dispatcher:**
1. Reads business memory and agent soul
2. Finds lead agent (system role with `runsHeartbeat = true`)
3. Builds context-aware prompt with backlog task list and gate status
4. Invokes Cursor SDK (no git-preflight — lead is orchestration, not code)
5. Parses agent output for a JSON list of task IDs to promote
6. Promotes up to `agent.heartbeatPromotionCap` tasks (default: 3)
7. Calls `maybeAutoTriggerTask` per promotion → worker agents are triggered automatically

**`runner/lead-heartbeat-prompt.ts` — prompt builder:**
- Injects: agent soul, business memory, backlog tasks with gate status markers
- Tasks show `[READY]` or `[BLOCKED: <reason>]`
- Instructs agent to return a `{ "promote": ["uuid", ...] }` JSON block
- Dependency-aware: shows dependency titles to help lead prioritise

**`runner/poll.ts` — lead heartbeat scheduler:**
```typescript
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes per business
```
- `scheduleLeadHeartbeats()` runs before every `pollOnce()` tick
- Creates `lead_heartbeat` orchestration events for businesses with a lead agent
- In-process throttle prevents double-scheduling within the interval

**`lib/heartbeat/actions.ts` — manual UI routing:**
- When a user clicks "Run Heartbeat" for a lead agent, the Server Action now routes to the runner queue instead of invoking Cursor SDK directly
- Non-lead agents continue using the existing direct invocation path

**`lib/tasks/runner-promote.ts` — runner-side promotion helper:**
- Bypasses Server Action authentication for runner-initiated promotions
- Calls `maybeAutoTriggerTask` after each successful promotion

---

## Test Coverage

| Area | Test file | Tests |
|------|-----------|-------|
| Webhook receive endpoint | `app/api/webhooks/.../route.test.ts` | 4 |
| GitHub PR webhook handler | `lib/github/__tests__/pr-webhook-handler.test.ts` | 8 |
| Branch settings actions | `lib/settings/__tests__/branch-actions.test.ts` | 10 |
| Memory actions | `lib/settings/__tests__/memory-actions.test.ts` | 6 |
| Agent Cursor field validation | `lib/agents/__tests__/update-agent-cursor-fields.test.ts` | 7 |
| Comment routing | `lib/tasks/__tests__/mention-trigger.test.ts` | 6 |
| Gate evaluator | `lib/tasks/__tests__/gate-evaluator.test.ts` | 9 |
| Auto-trigger | `lib/tasks/__tests__/auto-trigger.test.ts` | 6 |
| Git preflight | `runner/git-preflight.test.ts` | 8 |
| Cursor config resolver | `runner/cursor-config-resolver.test.ts` | 5 |
| Runner readiness check | `runner/readiness-check.test.ts` | 3 |
| Poll loop mutex + cap | `runner/poll.test.ts` | 12 |
| Lead heartbeat dispatcher | `runner/__tests__/lead-heartbeat.test.ts` | 14 |
| Lead heartbeat prompt | `runner/__tests__/lead-heartbeat-prompt.test.ts` | 5 |
| Lead heartbeat scheduler | `runner/__tests__/lead-heartbeat-scheduler.test.ts` | 4 |

**Total across all 82 test files: 358 tests — all passing.**

---

## Architecture: Full Autonomous Flow

```
Human / Lead Agent
       │
       ▼
  scheduleLeadHeartbeats()  ← runner/poll.ts (every 5 min per business)
       │ creates lead_heartbeat event
       ▼
  pollOnce() → dispatchLeadHeartbeat()
       │ reads backlog, evaluates gates, builds prompt
       │ runs Cursor SDK (lead agent)
       │ parses { "promote": [...] } from output
       │ calls promoteTaskToTodo() for each (up to cap)
       ▼
  maybeAutoTriggerTask()    ← lib/tasks/auto-trigger.ts
       │ evaluates gates (dependency_ok && pr_ok)
       │ sets gatesLockedAt (optimistic lock / idempotency)
       │ creates webhook_trigger event
       ▼
  pollOnce() → dispatchOrchestrationEvent()
       │ per-agent mutex: only one run at a time
       │ business parallel cap enforced
       │ git-preflight for code agents (fetch, clean check, worktree)
       │ Cursor runtime resolved (auto/inherit/concrete)
       │ runs Cursor SDK (worker agent)
       ▼
  Worker agent completes → PR opened → GitHub webhook
       │ handlePullRequestEvent() updates prMergedToIntegration
       │ maybeAutoTriggerTask() re-evaluated for dependent tasks
       ▼
  Next tasks in backlog become ready → cycle continues
```

---

## Git State (after cleanup)

```
Branch:    main
Commit:    1ba0e4c (Merge pull request #28 from eskobar95/feat/lead-heartbeat)
Worktrees: 1 (ai-business/ → main)
Open PRs:  0
Stale remote branches removed:
  - origin/feat/cursor-runtime-and-runner-s5 (auto-deleted on PR #27 merge)
  - origin/feat/trigger-logic                (manually deleted after PR #26)
  - origin/feat/lead-heartbeat               (auto-deleted on PR #28 merge)
  - origin/docs/pr-summary-tx1-runner-s5     (manually deleted — agent stray)
  - origin/feat/runner-core                  (manually deleted — agent stray)
```

---

## Database Migrations Applied

| Migration | Description | Applied |
|-----------|-------------|---------|
| 0013 | Add `todo` to `task_status` enum | ✅ S1 |
| 0014 | New columns on `tasks`, `businesses`, `agents` | ✅ S1 |
| 0015 | New flags on `system_roles` | ✅ S1 |
| 0016 | System roles seed | ✅ S1 |
| 0017 | `webhook_deliveries.business_id` nullable | ✅ S3 |
| 0018 | GIN index on `github_installations.repos` | ✅ S3 |

S4, S5, TX1, S6, S7 introduced no schema changes — pure application logic.

---

## Quality Gate Assessment

| Stream | Gate | Notes |
|--------|------|-------|
| S1 | 🟢 Green | Schema changes with reversible migrations |
| S2 | 🟢 Green | UI + validated Server Actions |
| S3 | 🟢 Green | Webhook verification + idempotency |
| S4 | 🟢 Green | RBAC-gated promotion; gate indicator in UI |
| S5+TX1 | 🟢 Green | Mutex, git-preflight, config resolver all tested |
| S6 | 🟢 Green | Gate evaluation and auto-trigger fully covered |
| S7 | 🟡 Yellow | Requires manual smoke-test: lead agent must have soul, business must have memory and localPath |

**Yellow follow-up for S7:**
- [ ] Smoke-test: configure a lead agent with `runsHeartbeat=true` system role, set `localPath` and `integrationBranch` in workspace settings, verify heartbeat event is created within 5 minutes and tasks are promoted
- [ ] Production deployment: Cursor CLI must be available on server, `CURSOR_API_KEY` set in runner environment

---

## Next Steps (Post v1)

| Item | Priority | Notes |
|------|----------|-------|
| TX2 — `.env.example` update | High | Document `GITHUB_WEBHOOK_SECRET` and `CURSOR_API_KEY` |
| TX3 — End-to-end integration test | High | Gate → trigger → worker run → PR → merge → next task |
| S7 smoke-test | High | See Yellow gate above |
| GitHub App installation flow | Medium | Currently requires manual webhook setup in GitHub |
| Multi-worktree cleanup in runner | Medium | After worker completes, runner should auto-remove worktree |
| Cross-process mutex (Redis/DB) | Low | Current mutex is in-process only; MVP acceptable |
| Hermes Agent CLI support | Low | Explicitly deferred; Cursor CLI is sole executor for now |
