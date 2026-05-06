# GitHub integration helpers

Server-only utilities for GitHub App state per business.

| File | Purpose |
|------|---------|
| `get-github-installed.ts` | Returns whether GitHub is connected (stub: always `false` until Stream C). |

## Stream C

Replace the stub with a query against `github_installations` (or the final table name) and token handling per the enterprise platform spec.
