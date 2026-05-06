# Settings (dashboard)

Settings uses **`?businessId=`** and **`&section=`** query params:

| Section (`section`) | Content |
|---------------------|---------|
| `account` | Cursor API key (encrypted user settings). |
| `business` | Business profile (name, branding copy, website). |
| `workspace` | Local path, GitHub repo URL, description for CLI context. |
| `integrations` | GitHub App installation + installation token status (server-held secrets). |
| `mcp` | MCP Library (credentials + agent access). |
| `webhooks` | Inbound webhook URL + delivery log table. |

`BusinessSelector` preserves non-`businessId` params when switching tenants (e.g. stays on the same section).

Legacy routes `/dashboard/webhooks` and `/dashboard/notion` **redirect** into the matching settings section.
