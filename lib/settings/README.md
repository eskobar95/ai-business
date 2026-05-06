# Settings actions

| File | Role |
|------|------|
| `actions.ts` | Account Cursor API key (`verifyAndSaveCursorApiKey` / `saveUserSettings` — same path: empty clears; non-empty validated with `Cursor.me` then encrypted) + business fields + `getSettingsPageState`. |
| `branch-validation.ts` | Pure helpers: `normalizeBranchValue`, `assertValidOptionalBranchField` (imported by `branch-actions`, not `"use server"`). |
| `branch-actions.ts` | `updateBusinessBranchSettings`, `updateBusinessParallelSettings`, `updateBusinessCursorDefaults`. |
| `memory-actions.ts` | `updateMemoryContent`, `createBusinessMemorySection` for business-scope memory rows. |
| `cursor-api-key.ts` | Session `getUserCursorApiKeyDecrypted`, `getCursorApiKeyDecryptedForUserId`, `resolveCursorApiKeyForBusiness` (runner: first linked member with a key) — AES blob in `user_settings`. |
| `integrations-panel.ts` | `loadSettingsIntegrationsPanel` — webhook endpoint URL + delivery count + `getMcpLibraryBoard` for Settings MCP section. |
