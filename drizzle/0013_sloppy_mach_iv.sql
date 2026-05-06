-- Forward: template_seeded + routines (Stream B). Rollback (manual, dev/staging only):
--   DROP INDEX IF EXISTS "routines_is_active_next_run_at_idx";
--   DROP INDEX IF EXISTS "routines_agent_id_idx";
--   DROP INDEX IF EXISTS "routines_business_id_idx";
--   ALTER TABLE "routines" DROP CONSTRAINT IF EXISTS "routines_business_id_agent_id_agents_business_id_id_fk";
--   ALTER TABLE "routines" DROP CONSTRAINT IF EXISTS "routines_business_id_businesses_id_fk";
--   DROP TABLE IF EXISTS "routines";
--   ALTER TABLE "businesses" DROP COLUMN IF EXISTS "template_seeded";

CREATE TABLE "routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cron_expression" text NOT NULL,
	"human_schedule" text NOT NULL,
	"prompt" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "template_seeded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_business_id_agent_id_agents_business_id_id_fk" FOREIGN KEY ("business_id","agent_id") REFERENCES "public"."agents"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routines_business_id_idx" ON "routines" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "routines_agent_id_idx" ON "routines" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "routines_is_active_next_run_at_idx" ON "routines" USING btree ("is_active","next_run_at");