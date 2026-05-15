ALTER TABLE "missions" ADD COLUMN "validation_contract" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "project_type" text DEFAULT 'new_project' NOT NULL;