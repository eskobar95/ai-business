-- Manual rollback companion for 0017_cloudy_cargill.sql
-- NOT executed by drizzle-kit — applied only after review.
-- Requires no rows with webhook_deliveries.business_id IS NULL (delete or reconcile first).

ALTER TABLE "webhook_deliveries" ALTER COLUMN "business_id" SET NOT NULL;
