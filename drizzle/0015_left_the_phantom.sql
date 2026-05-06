ALTER TYPE "public"."task_status" ADD VALUE 'todo' BEFORE 'in_progress';--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "cursor_model_id" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "cursor_thinking_effort" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "cursor_runtime_profile" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "heartbeat_promotion_cap" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "integration_branch" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "release_branch" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "max_parallel_runs" integer;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "default_cursor_model_id" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "default_cursor_thinking_effort" text;--> statement-breakpoint
ALTER TABLE "system_roles" ADD COLUMN "requires_git_workspace" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "system_roles" ADD COLUMN "may_promote_backlog_to_todo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "system_roles" ADD COLUMN "requires_pr_merge_gate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "system_roles" ADD COLUMN "runs_heartbeat" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "dependency_task_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "github_pr_number" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "github_repo_installation_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "github_pr_status" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "pr_merged_to_integration" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "gates_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_github_repo_installation_id_github_installations_id_fk" FOREIGN KEY ("github_repo_installation_id") REFERENCES "public"."github_installations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_dependency_task_id_tasks_id_fk" FOREIGN KEY ("dependency_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_dependency_task_id_idx" ON "tasks" USING btree ("dependency_task_id");--> statement-breakpoint
CREATE INDEX "tasks_github_repo_installation_id_idx" ON "tasks" USING btree ("github_repo_installation_id");