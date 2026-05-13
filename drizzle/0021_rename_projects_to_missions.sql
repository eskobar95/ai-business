ALTER TABLE "projects" RENAME TO "missions";--> statement-breakpoint
ALTER INDEX "projects_business_id_idx" RENAME TO "missions_business_id_idx";--> statement-breakpoint
ALTER INDEX "projects_status_idx" RENAME TO "missions_status_idx";--> statement-breakpoint
ALTER TABLE "sprints" RENAME COLUMN "project_id" TO "mission_id";--> statement-breakpoint
ALTER INDEX "sprints_project_id_idx" RENAME TO "sprints_mission_id_idx";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "project_id" TO "mission_id";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "project" TO "mission";--> statement-breakpoint
ALTER INDEX "tasks_project_id_idx" RENAME TO "tasks_mission_id_idx";--> statement-breakpoint
