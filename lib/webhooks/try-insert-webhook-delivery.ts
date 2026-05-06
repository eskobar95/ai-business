import { getDb } from "@/db/index";
import { webhookDeliveries } from "@/db/schema";
import { isPostgresUniqueViolation } from "@/lib/webhooks/pg-errors";

export type WebhookDeliveryInsert = typeof webhookDeliveries.$inferInsert;

/**
 * Inserts a `webhook_deliveries` row. Returns `duplicate` on Postgres unique violation
 * (idempotency key race) so callers can respond with 202 without treating it as an error.
 */
export async function tryInsertWebhookDelivery(
  values: WebhookDeliveryInsert,
): Promise<"inserted" | "duplicate"> {
  const db = getDb();
  try {
    await db.insert(webhookDeliveries).values(values);
    return "inserted";
  } catch (err) {
    if (isPostgresUniqueViolation(err)) return "duplicate";
    throw err;
  }
}
