# Business helpers

- **`ensure.ts`** — `ensureBusiness(businessId)` loads the session user and asserts membership via `user_businesses` (`assertUserBusinessAccess`). Used by server actions that scope data to a workspace.
