# Dashboard components

Banner and modal components for the main dashboard experience.

| File | Purpose |
|------|---------|
| `setup-banner.tsx` | Client banner for one-click enterprise template provisioning; dismiss stored in `localStorage`. |
| `template-preview-modal.tsx` | Modal with template preview, **Activate** calling `seedEnterpriseTemplateAction`. |
| `github-banner.tsx` | Compact CTA when GitHub is not connected (stubbed until Stream C). |

## Usage

Mounted from `app/dashboard/page.tsx` and `app/dashboard/agents/page.tsx` with server-provided props.
