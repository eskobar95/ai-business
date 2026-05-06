# `POST /api/github/webhook`

GitHub App webhook URL. Verifies `X-Hub-Signature-256` against `GITHUB_WEBHOOK_SECRET`, dedupes deliveries with `X-GitHub-Delivery` (`webhook_deliveries.idempotency_key`), and forwards `pull_request` events to [`lib/github/pr-webhook-handler.ts`](../../../lib/github/pr-webhook-handler.ts).

`webhook_deliveries.business_id` may be **NULL** when GitHub’s payload cannot be tied to an existing `github_installations` row (migration `0017`); deliveries are still stored for deduplication.
