CREATE TABLE "github_installation_selected_repos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" uuid NOT NULL,
	"repo_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_installation_selected_repos" ADD CONSTRAINT "github_installation_selected_repos_installation_id_github_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_install_selected_repos_unique" ON "github_installation_selected_repos" USING btree ("installation_id","repo_url");--> statement-breakpoint
CREATE INDEX "github_install_selected_repos_installation_idx" ON "github_installation_selected_repos" USING btree ("installation_id");--> statement-breakpoint
ALTER TABLE "github_installations" DROP COLUMN "selected_repos";