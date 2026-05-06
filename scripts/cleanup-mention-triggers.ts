/**
 * One-off cleanup: mark stale `mention_trigger` orchestration rows as failed after S6 migration to `webhook_trigger`.
 *
 * Run after deploy: `npm run db:cleanup-mention-triggers`
 */
import { getDb } from "@/db/index";
import { orchestrationEvents } from "@/db/schema";
import { and, eq } from "drizzle-orm";

async function main() {
  const db = getDb();
  const result = await db
    .update(orchestrationEvents)
    .set({
      status: "failed",
      payload: {
        runnerError: "Deprecated: mention_trigger migrated to webhook_trigger (S6 cleanup)",
      },
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orchestrationEvents.type, "mention_trigger"),
        eq(orchestrationEvents.status, "pending"),
      ),
    )
    .returning({ id: orchestrationEvents.id });

  console.log(`Cleaned up ${result.length} stale mention_trigger events.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
