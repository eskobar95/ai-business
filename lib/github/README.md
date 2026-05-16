# GitHub App integration (Stream C)

Server-only modules — **never** import secrets or `getInstallationToken()` from Client Components.

| File | Responsibility |
|------|----------------|
| `pending-install-cookie.ts` | HMAC-signed HttpOnly cookie binds a GitHub install redirect to a `business_id`. |
| `app-jwt.ts` | RS256 JWT for GitHub App machine user (`createGithubAppJwt`). |
| `rest.ts` | GitHub REST helpers: installations, mint token, repo list, **revoke installation token**. |
| `bootstrap.ts` | `finalizeGithubInstallationForBusiness` — called from `/api/github/callback`. |
| `installation-db.ts` | Drizzle upsert/delete + encrypted token columns (AES-256-GCM via `encryptCredential`). |
| `client.ts` | `getInstallationToken(businessId)` — decrypt + refresh within 5-minute margin. |
| `repo-context.ts` | `buildRepoContextForPrompt`; **exported** `resolveRepoUrl` / `parseOwnerRepo` — markdown snapshot (README, tree, key files, PRs/issues/commits). |
| `mention-paths.ts` | `parseMentionedRepoPaths` — extracts repo-relative paths from chat text for PO prefetch (max 5). |
| `repo-files.ts` | `readRepoFile` / `listRepoPath` — GitHub Contents API (installation token); traversal / `.env` / extension allowlist; **100 KiB** max decoded read (`MAX_REPO_FILE_BYTES`). |
| `agent-git-config.ts` | Builds `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env map for runner subprocesses. |
| `installation-queries.ts` | Safe read for Settings (no tokens). |
| `actions.ts` | `disconnectGithubInstallation` — revokes current token via GitHub `DELETE /installation/token` (throws from `rest.ts` on non-404 errors; caller logs `console.warn` but still deletes the DB row). |
| `get-github-installed.ts` | Returns whether GitHub is connected for a business (used by dashboard banner). |
| `pr-webhook-handler.ts` | Maps `pull_request` actions → `tasks.github_pr_status`; sets `pr_merged_to_integration` when merged into `businesses.integration_branch`; calls `maybeAutoTriggerTask` per affected task (auto-start idempotency uses `gates_locked_at`); emits `github.pr.merged` orchestration event. Repo match uses `installation.id` first, then **`repos` JSONB `@>`** containment (no full-table scan). |

## Routes

- `GET /api/github/install?businessId=` — session + membership check, sets cookie, redirects to `https://github.com/apps/<GITHUB_APP_SLUG>/installations/new`.
- `GET /api/github/callback` — configure as **Setup URL** in the GitHub App; exchanges installation token and upserts `github_installations`.
- `POST /api/github/webhook` — GitHub App webhook delivery; verifies `X-Hub-Signature-256` with `GITHUB_WEBHOOK_SECRET`, dedupes via `webhook_deliveries.idempotency_key` (`X-GitHub-Delivery`), updates `tasks` PR fields from `pull_request` events (`pr-webhook-handler.ts`).

## Environment variables

See `.env.example` (`GITHUB_APP_*`, **`GITHUB_WEBHOOK_SECRET`** for `/api/github/webhook`). `ENCRYPTION_KEY` (64 hex chars) is required for signing install cookies and persisting installation tokens.
