-- Idempotent fix: rename projects → missions table and related columns.
-- Required because migration 0021 was skipped on databases that had already
-- recorded a different migration with idx=21 (the original Conductor migration
-- before branch renumbering). All checks use existence guards so the migration
-- is safe to apply on databases that are already up-to-date.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) THEN
    ALTER TABLE "projects" RENAME TO "missions";
  END IF;
END$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'projects_business_id_idx'
  ) THEN
    ALTER INDEX "projects_business_id_idx" RENAME TO "missions_business_id_idx";
  END IF;
END$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'projects_status_idx'
  ) THEN
    ALTER INDEX "projects_status_idx" RENAME TO "missions_status_idx";
  END IF;
END$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sprints' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE "sprints" RENAME COLUMN "project_id" TO "mission_id";
  END IF;
END$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'sprints_project_id_idx'
  ) THEN
    ALTER INDEX "sprints_project_id_idx" RENAME TO "sprints_mission_id_idx";
  END IF;
END$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE "tasks" RENAME COLUMN "project_id" TO "mission_id";
  END IF;
END$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'project'
  ) THEN
    ALTER TABLE "tasks" RENAME COLUMN "project" TO "mission";
  END IF;
END$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'tasks_project_id_idx'
  ) THEN
    ALTER INDEX "tasks_project_id_idx" RENAME TO "tasks_mission_id_idx";
  END IF;
END$$;
