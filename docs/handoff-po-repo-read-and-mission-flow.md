# Handoff: Product Owner repo-læsning + konsistent mission → approval → task → runner flow

**Created:** 2026-05-16  
**Audience:** New Cursor agent session  
**Business context:** MercFlow workspace on AI Business Platform; primary GitHub repo **`eskobar95/mercflow`** (selected in Settings → Integrations).

---

## 1. Product goal (why this work exists)

The team has framed the platform and connected GitHub, but does not know how to **start executing on MercFlow** inside the product. They need:

1. **Product Owner** to understand **business memory** (soul) **and** **codebase reality** (mercflow).
2. PO to propose **missions** with validation contracts.
3. Missions → **PRD** (mission fields) → **sprint brief** (PO) → **human approval** → **EM decomposition** → **tasks** → **runners** (local Cursor SDK with repo checkout).

**Core gap:** PO briefing is still **simulated**. PO chat now gets **live file/directory prefetch** when the user names allowlisted repo paths (plus static snapshot); still **not** a full IDE-style arbitrary browse without naming paths.

---

## 2. Where the codebase stands NOW

### 2.1 Git / branch truth (verify first)

| State | What |
|-------|------|
| **Branch** | `main` |
| **Phase A merged** | PR [#42](https://github.com/eskobar95/ai-business/pull/42) → `f6df374` on `origin/main` (feat commits incl. `6521d3c`; E2E fix hides Conductor FAB before communication delete — `31bf79c`) |
| **`origin/main` now** | Phase 0 + Phase A: chat shell + PO prefetch (`repo-files`, `mention-paths`, SSE `repo_tool_*`, PO-only inject `## Requested files`) |
| **Phase 0** | PR [#41](https://github.com/eskobar95/ai-business/pull/41) — merge `a54f201`; docs `13454d6` |
| **Local UNCOMMITTED** | None expected; run `git status` to confirm |

**Action for new session:** Work from **`main`**. Start **Phase B** (mission wizard repo panel) — see § Phase B.

Recent commits (`main`, newest first — verify with `git log`):
- `f6df374` — merge PR #42 (Phase A)
- `31bf79c` — fix(e2e): hide Conductor FAB before communication edge delete
- `6521d3c` — feat: PO chat repo prefetch (GitHub Contents API)

### 2.2 End-to-end flow (as implemented today)

```
Grill-Me → business memory (memory table, scope=business)
     ↓
Dashboard → Agents → Product Owner → Chat session
     (/dashboard/chats/[sessionId])
     POST /api/chat/[sessionId]/send  →  Cursor SDK (server, no local.cwd)
     Injects: business prefix + GitHub snapshot + (PO only) live "## Requested files" for parsed paths + agent SOUL
     ↓
Missions wizard (/dashboard/missions/new) → createMission
     Fields: name, project_type, prd, validation_contract + soul sidebar
     NO repo injection today
     ↓
Mission detail → "Kickstart Product Owner"
     runProductOwnerBriefing → sprint (planning) + approval (po_sprint_brief)
     SIMULATED markdown today (TODO: runCursorAgent)
     ↓
Human → Approvals (/dashboard/approvals) → approve
     ↓
Approval detail → "Engineering Manager decomposition" (manual button)
     runEngineeringManagerDecomposition → tasks in backlog + sprint active
     SIMULATED task list today
     ↓
Tasks promoted / gates / webhook_trigger → runner/dispatch.ts
     Agent.create({ local: { cwd } }) — FULL repo access on runner machine
```

### 2.3 What works vs what does not

| Capability | Status | Key files |
|------------|--------|-----------|
| GitHub App connect + repo select | Works | `app/dashboard/settings/settings-integrations-section.tsx`, `lib/github/actions.ts`, `github_installations`, `github_installation_selected_repos` |
| Chat stream + persist messages | Works | `app/api/chat/[sessionId]/send/route.ts`, `hooks/use-chat-stream.ts`, `chat_sessions`, `chat_messages` |
| Repo snapshot in chat prompt | Works | `lib/github/repo-context.ts` — README, tree depth≤3, key files, commits/PRs/issues |
| PO live path prefetch (`product_owner` + connected repo) | Works | `lib/github/repo-files.ts`, `lib/github/mention-paths.ts`, `POST /api/chat/.../send` — parses paths (`lib/`, `src/`, …), GitHub Contents API, injects `## Requested files`; SSE `repo_tool_*` → tool UI |
| PO understands mercflow deeply | **Partial** | Grounding improves when user names concrete paths; generic questions still depend on model + snapshot |
| Mission create | Works | `lib/missions/actions.ts`, `app/dashboard/missions/new/mission-wizard.tsx` |
| PO sprint brief | **Simulated** | `lib/missions/po-briefing-action.ts` line ~153 TODO |
| Approval gate | Works | `lib/approvals/actions.ts`, `createApproval` from PO briefing |
| EM decompose after approve | Works (simulated output) | `lib/missions/em-decompose-action.ts`, `app/dashboard/approvals/[approvalId]/em-decompose-button.tsx` |
| Runner execution | Works (separate process) | `runner/dispatch.ts`, `lib/tasks/auto-trigger.ts`, `webhook_trigger` events |
| Chat → mission proposal blocks | **Not built** | Discussed in prior session, not implemented |

### 2.4 Architecture constraints (do not violate)

From `.cursor/rules/project.mdc` and `AGENTS.md`:

- Chat send route: **server-only**, Neon DB, **no** `local.cwd` (server-deployable).
- Runners: **local** checkout + Cursor SDK; triggered by **orchestration events**, not long serverless runs.
- Notion = external SoT for backlog; DB = orchestration + memory.
- Secrets: `getInstallationToken(businessId)` server-only; never expose to client.
- All schema changes: `drizzle-kit generate` + `migrate`.

### 2.5 Terminology (user confusion)

| Term | Meaning in this repo |
|------|----------------------|
| **Validation contract** | `missions.validation_contract` — done criteria for a mission |
| **Contract layer** (PO hallucination) | Not a GitHub integration layer — do not build unless spec'd |
| **Runner** | `runner/` process handling `webhook_trigger`, `lead_heartbeat`, etc. |
| **Chat session** | `chat_sessions` + SSE — discussion only |
| **Approval session** | `approvals` row + artifactRef JSON |

---

## 3. Recommended delivery order (full detail)

### Phase 0 — Stabilize current chat work (0.5–1 day)

**Goal:** Clean baseline on `main` before PO repo-tools.

| Task | Description | Acceptance |
|------|-------------|------------|
| 0.1 | `git status`; commit or branch all chat/AI Elements changes | `npm run typecheck` green; `npm test` green |
| 0.2 | Push to `origin/main` or open PR | Remote matches local intent |
| 0.3 | Smoke: PO chat, mercflow selected, ask “Which repo is in your GitHub section? Quote README first lines.” | Agent cites `eskobar95/mercflow` or honest “not connected” |

**Files touched (likely):** whole `components/chat/*`, `components/ai-elements/*`, `hooks/use-chat-stream.ts`, `lib/chat/*`, `package.json`, `app/globals.css`, `app/layout.tsx`.

---

### Phase A — Server-side repo read tools in PO chat (P0, 3–5 days)

**Goal:** PO chat can list/read mercflow files like a read-only IDE, via GitHub API.

#### A1 — Shared GitHub file service

**New:** `lib/github/repo-files.ts` (or extend `repo-context.ts`)

```typescript
// Suggested exports:
readRepoFile(businessId, path, ref?: string): Promise<{ content: string; truncated: boolean }>
listRepoPath(businessId, path, ref?: string): Promise<{ entries: { name; path; type }[] }>
searchRepoText?(businessId, query): Promise<...>  // optional P1
```

- Reuse `resolveRepoUrl` + `getInstallationToken` + `parseOwnerRepo` from `lib/github/repo-context.ts`.
- Reuse patterns from `lib/skills/file-actions.ts` (`fetchGithubFileContent`, contents API).
- Limits: max file bytes (e.g. 100KB), allowlist extensions (`.ts`, `.tsx`, `.md`, `.json`, …), deny `.env`, secrets paths.
- Tests: `lib/github/__tests__/repo-files.test.ts` with mocked `fetch`.

#### A2 — Tool loop in chat send route

**Modify:** `app/api/chat/[sessionId]/send/route.ts`

Today: one-shot `agent.send(prompt)` + stream until done.

Needed: **agentic loop** (max N turns, e.g. 5):

1. Send prompt with tool definitions (or structured instructions).
2. On SDK `tool_call` / `tool_use` for `read_repo_file` / `list_repo_path`, execute server-side, append results.
3. Continue until model finishes or max turns.

**If Cursor SDK cannot attach custom tools on server agent:** implement **server-orchestrated prefetch**:

- Parse user message for paths (`lib/missions`, `src/...`).
- Fetch files before `agent.send`, append to prompt under `## Requested files`.

Prefer real tool loop if SDK supports MCP/tools on `Agent.create` without `local.cwd` — check `@cursor/sdk` docs / `runner/dispatch.ts` for patterns.

#### A3 — SSE + client wiring

**Modify:**

- `app/api/chat/[sessionId]/send/route.ts` — emit existing `tool_call` events (bridge already in `lib/chat/chat-sse.ts` for SDK tools).
- `hooks/use-chat-stream.ts` — handle `tool_call` (partially present); ensure UI updates.
- `components/chat/chat-message-blocks.tsx` — show `Tool` when `features.tools` (enable in `CHAT_CONFIGS.agentChat`).

**New SSE events (if custom tools):**

```text
event: repo_tool_start
event: repo_tool_result
```

Or map to existing `tool_call` payload: `{ id, name, state, input, result }`.

#### A4 — PO prompt contract

**Modify:** `buildBusinessContext` in send route + optionally PO `SOUL.md` template shard:

- When tools exist: “Use `read_repo_file` / `list_repo_path` to inspect mercflow before proposing missions.”
- When snapshot present: “Snapshot may be stale; prefer tools for specific paths.”
- Never tell user to “connect GitHub” if `## GitHub Repository:` is present.

#### A5 — Acceptance tests (Phase A)

| # | Test |
|---|------|
| 1 | PO chat: “List files in `lib/missions`” → returns real paths from mercflow |
| 2 | PO chat: “Read `lib/missions/actions.ts` first 50 lines” → substantial real content |
| 3 | PO chat: “Summarize how missions connect to approvals” → accurate per code |
| 4 | Unit: `readRepoFile` rejects path `../.env` |
| 5 | `npm test` + `npm run typecheck` green |

---

### Phase B — Mission flow + repo context (P1, 2–3 days)

**Goal:** Creating/editing missions is informed by repo, not only soul.

#### B1 — Mission wizard / detail context panel

**Modify:**

- `app/dashboard/missions/new/page.tsx` + `mission-wizard.tsx`
- `app/dashboard/missions/[missionId]/page.tsx`

Server component fetches `buildRepoContextForPrompt(businessId)` or slimmer `buildRepoSummaryForMission(businessId)` (commits + top-level tree + link to PO chat).

Show read-only panel: “Connected repo: eskobar95/mercflow” + last commits.

#### B2 — Optional: “Suggest mission from repo” action

**New server action:** `suggestMissionFromRepo(businessId)` — calls Cursor with soul + repo summary; returns draft `{ name, goal, validationContract }` for wizard prefill.

#### B3 — Acceptance

| # | Test |
|---|------|
| 1 | New mission page shows repo name and recent activity |
| 2 | PO can open chat from mission with missionId in session metadata (optional P2) |

**Schema (optional):** `chat_sessions.mission_id` FK — only if linking sessions to missions; migration required.

---

### Phase C — Real PO briefing + EM with repo (P1, 3–4 days)

**Goal:** Replace simulated PO/EM outputs with Cursor agent + same repo access as chat.

#### C1 — Wire `runProductOwnerBriefing`

**Modify:** `lib/missions/po-briefing-action.ts`

- Replace `buildSimulatedSprintBrief` with `runCursorAgent` or shared `runAgentWithRepoTools(poPrompt, businessId)`.
- Prompt must include: mission fields, soul, **`buildRepoContextForPrompt`** + tool access (Phase A library).
- Store output in `sprints.goal`; keep approval `artifactRef`: `{ sprintId, missionId, artifactType: "po_sprint_brief" }`.

#### C2 — Wire `runEngineeringManagerDecomposition`

**Modify:** `lib/missions/em-decompose-action.ts`

- Replace simulated tasks with agent output (structured JSON or markdown list parsed into `tasks` inserts).
- Input: approved sprint brief + repo context + roster slugs (`software_engineer`, `qa_engineer`, …).

#### C3 — Approval UX polish

**Modify:** `app/dashboard/approvals/[approvalId]/page.tsx`

- Show sprint brief markdown rendered.
- EM button only when `approved` + `po_sprint_brief` (already `shouldShowEngineeringManagerDecompose`).

#### C4 — Acceptance

| # | Test |
|---|------|
| 1 | Kickstart PO on mission → non-simulated brief referencing real mercflow modules |
| 2 | Approve → EM decompose → tasks created with sensible titles |
| 3 | Promote task → `webhook_trigger` → runner can execute (existing path) |

---

### Phase D — Chat → mission bridge (P2, optional)

Discussed prior session, not started:

- Parse `<mission>...</mission>` blocks from PO chat SSE.
- `MissionProposalCard` + `createMission()` on user confirm.

**Defer** until Phase A–C stable.

---

## 4. File map (quick reference)

| Area | Path |
|------|------|
| Chat API | `app/api/chat/[sessionId]/send/route.ts` |
| Chat SSE bridge | `lib/chat/chat-sse.ts` |
| Chat hook | `hooks/use-chat-stream.ts` |
| Chat UI shell | `components/chat/chat-shell.tsx`, `chat-layout.tsx`, `chat-bubble.tsx` |
| Chat features flags | `lib/chat/chat-config.ts` |
| Repo snapshot | `lib/github/repo-context.ts` |
| GitHub token | `lib/github/client.ts` |
| File fetch precedent | `lib/skills/file-actions.ts` |
| Missions CRUD | `lib/missions/actions.ts` |
| PO briefing | `lib/missions/po-briefing-action.ts` |
| EM decompose | `lib/missions/em-decompose-action.ts` |
| Approvals | `lib/approvals/actions.ts`, `lib/approvals/queries.ts` |
| Runner | `runner/dispatch.ts`, `runner/prompt-builder.ts` |
| Tasks / triggers | `lib/tasks/actions.ts`, `lib/tasks/auto-trigger.ts`, `lib/tasks/mention-trigger.ts` |
| PRD autonomous flow | `docs/prd-autonomous-agent-flow-v1.md`, `docs/tasks-autonomous-agent-flow-v1.md` |
| Project rules | `.cursor/rules/project.mdc`, `AGENTS.md` |

---

## 5. Agent session prompts (copy-paste)

### Phase 0 — Commit chat shell

```
Read docs/handoff-po-repo-read-and-mission-flow.md § Phase 0.
Stabilize uncommitted chat/AI Elements work: typecheck, npm test, commit with conventional message, push or PR.
Update handoff §2.1 with final commit SHA.
Do not start Phase A yet.
```

### Phase A1+A2 — repo-files + chat tool loop

```
Read docs/handoff-po-repo-read-and-mission-flow.md § Phase A (A1, A2).
Implement lib/github/repo-files.ts + tests.
Integrate read/list into POST /api/chat/[sessionId]/send (tool loop or path-aware prefetch).
Document limits in lib/github/README.md.
Gate: npm test, typecheck, manual PO chat smoke on mercflow paths.
```

### Phase A3+A4+A5 — SSE/UI/prompts

```
Depends on Phase A2 merged.
Read docs/handoff-po-repo-read-and-mission-flow.md § Phase A (A3–A5).
Wire tool_call UI, CHAT_CONFIGS.tools, PO prompt instructions.
Complete acceptance tests § Phase A5.
```

### Phase B — mission wizard repo panel

```
Read docs/handoff-po-repo-read-and-mission-flow.md § Phase B.
Add repo summary to mission new + detail pages; optional suggestMissionFromRepo.
```

### Phase C — PO briefing + EM agent

```
Read docs/handoff-po-repo-read-and-mission-flow.md § Phase C.
Replace simulated outputs in po-briefing-action.ts and em-decompose-action.ts with runCursorAgent + repo context from Phase A.
Integration test: mission → kickstart PO → approve → EM decompose.
```

---

## 6. Environment & MercFlow setup

- **Repo:** `eskobar95/mercflow` selected in Integrations (1 of N); must click **Save selection**.
- **Env:** `DATABASE_URL`, `CURSOR_API_KEY` or per-business encrypted key, `GITHUB_APP_*`, `ENCRYPTION_KEY`.
- **Cursor model in chat:** `composer-2` hardcoded in send route.
- **PO agent:** Enterprise template slug `product_owner`; SOUL does not mention GitHub — update after Phase A.

---

## 7. Out of scope for this handoff

- Mission proposal cards from chat (Phase D).
- Notion/Linear MCP for PO (TOOLS.md lists them; separate integration).
- Moving chat to `local.cwd` (breaks server-deploy model).
- Auto-trigger EM on approve without human button (product choice; currently manual `EMDecomposeButton`).

---

## 8. Success definition (program level)

MercFlow team can:

1. Open PO chat, inspect mercflow structure via agent, draft mission ideas grounded in code.
2. Create mission with validation contract aligned to soul + repo.
3. Kickstart PO → review sprint brief → approve → EM tasks → runner executes — **without simulated placeholders** in PO/EM steps.

---

*End of handoff.*
