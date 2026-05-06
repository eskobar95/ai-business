# Webhooks

Server-side helpers for verifying incoming webhooks and recording idempotent deliveries in `webhook_deliveries`.

## Files

- **`hmac.ts`** — `signPayload` / `verifySignature` using HMAC-SHA256 and `crypto.timingSafeEqual` (compare hex digests).
- **`github-webhook-limits.ts`** — max body bytes for `/api/github/webhook`, `Content-Length` pre-check vs buffered UTF-8 size (`GITHUB_WEBHOOK_MAX_BODY_BYTES`).
- **`try-insert-webhook-delivery.ts`** — `tryInsertWebhookDelivery` wraps `insert` + `23505` idempotency for `webhook_deliveries`.
- **`pg-errors.ts`** — `isPostgresUniqueViolation` for Postgres `23505` (idempotent insert races).
- **`engine.ts`** — `deliverWebhook(type, businessId, payload, idempotencyKey, options?)` records a delivery row, runs optional `process`, and marks `delivered` or `failed`. Duplicate keys with status `delivered` or `pending` are skipped. For tests, pass a custom `adapter` implementing `WebhookDeliveryAdapter`.
- **`deliveries-queries.ts`** — `listWebhookDeliveriesByBusiness`, `countWebhookDeliveriesByBusiness` (authorized reads for dashboard log + Settings summary).
- **HTTP:** `app/api/webhooks/[businessId]/receive/route.ts` — `POST` with raw JSON body, required `X-Idempotency-Key`, `X-Webhook-Signature` (hex HMAC-SHA256 via `verifySignature`). Idempotent on key; writes `webhook_deliveries` and `orchestration_events` (`type: webhook_trigger`). Uses global `WEBHOOK_SECRET` for MVP.

## Configuration

- `WEBHOOK_SECRET` — used by `signPayload` / `verifySignature` when no explicit secret argument is passed.

## Usage

Call `verifySignature(rawBody, signatureHeader, process.env.WEBHOOK_SECRET)` on incoming HTTP webhooks, then `deliverWebhook(...)` with a stable `idempotencyKey` (e.g. provider delivery id).
