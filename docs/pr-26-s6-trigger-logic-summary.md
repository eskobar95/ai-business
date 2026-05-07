# PR #26 — S6 Trigger-logik (summary)

**PR:** https://github.com/eskobar95/ai-business/pull/26  
**Branch:** `feat/trigger-logic` → `main`  
**Worktree (anbefalet):** `C:/Users/Nicklas/Github/ai-business-s6-triggers` (`git worktree add ../ai-business-s6-triggers feat/trigger-logic`)

> **Scope:** Kun **S6** — kommentar-routing, gate-evaluering og auto-trigger. **Ikke** TX1, **ikke** Runner S5, **ikke** Cursor runtime / `feat/cursor-runtime-and-runner-s5`.

## What ships

| Track | Beskrivelse |
|-------|-------------|
| **T6.1** | Kommentar-routing (`routeCommentToAgents`): ingen mention → worker; mention → alle nævnte agenter. |
| **T6.2** | `evaluateTaskGates` — AND-gate (dependency todo + PR merge/integration) til brug fra promotion, status-opdateringer og S7. |
| **T6.3** | `maybeAutoTriggerTask` — auto-trigger når todo er klar og gates åbner; idempotens via `gatesLockedAt` /Batching i hooks. |
| **TX4** | `scripts/cleanup-mention-triggers.ts` + npm-script — rydder i støtte «pending» mention_trigger events. |

## Filer (implementerings-commit)

- **Tasks:** `lib/tasks/mention-trigger.ts`, `gate-evaluator.ts`, `auto-trigger.ts`, `actions.ts`, `log-actions.ts`, `lib/tasks/README.md`
- **GitHub webhook:** `lib/github/pr-webhook-handler.ts`, `lib/github/README.md`, webhook-tests
- **Scripts:** `scripts/cleanup-mention-triggers.ts`, `scripts/README.md`, `package.json`
- **Tests:** `lib/tasks/__tests__/mention-trigger.test.ts`, `gate-evaluator.test.ts`, `auto-trigger.test.ts`, opdateringer i `log-actions.test.ts`, `task-actions-s4.test.ts`, `lib/github/__tests__/pr-webhook-handler.test.ts`

## Kontekst-dokumentation

- **Agent-prompt:** `docs/agent-prompt-s6-trigger-logic.md`
- **PRD:** `docs/prd-autonomous-agent-flow-v1.md` (F3, F4)
- **Tasks:** `docs/tasks-autonomous-agent-flow-v1.md` (S6)

## Verification

```bash
cd C:/Users/Nicklas/Github/ai-business-s6-triggers
npm run lint
npm run typecheck
npm test
npm run build
```

## Quality gate (PR-body)

**Gul** — S6 leverer til S7 (heartbeat m.m. forventes at bruge `evaluateTaskGates`).

## Notes til merge/review

- Hold denne PR adskilt fra **runner/poll**, **agent Cursor-felter** og **S5**-branches; undgå at cherry-pick TX1/S5 ind i `feat/trigger-logic`.
- Efter merge: opdater evt. draft PR #26 body med link til denne fil, hvis I vil samle dokumentation ét sted.
