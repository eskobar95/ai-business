ALTER TABLE "tasks" DROP CONSTRAINT "tasks_dependency_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_business_id_dependency_task_id_tasks_business_id_id_fk" FOREIGN KEY ("business_id","dependency_task_id") REFERENCES "public"."tasks"("business_id","id") ON DELETE set null ON UPDATE no action;