ALTER TABLE "agents" ADD COLUMN "is_platform_default" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "agents" SET "is_platform_default" = true WHERE "slug" = 'conductor' AND "name" = 'Conductor';
