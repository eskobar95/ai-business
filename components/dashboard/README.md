# Dashboard components

Banner and modal components for the main dashboard experience.

| File | Purpose |
|------|---------|
| `setup-banner.tsx` | Client banner for one-click enterprise template provisioning; dismiss stored in `localStorage`. |
| `template-preview-modal.tsx` | Modal with template preview, **Activate** calling `seedEnterpriseTemplateAction`. |
| `github-banner.tsx` | Compact CTA when GitHub is not connected (stubbed until Stream C). |
| `conductor-nudge.tsx` | Async server snippet linking to the platform Conductor agent (`is_platform_default`); renders nothing when missing. |

## Usage

Mounted from `app/dashboard/page.tsx`, mission/task dashboard empty states, and `app/dashboard/agents/page.tsx` with server-provided props.
