CREATE TABLE "analytics_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"environment" text NOT NULL,
	"version" text NOT NULL,
	"deployed_at" timestamp with time zone NOT NULL,
	"description" text,
	"url" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_releases" ADD CONSTRAINT "analytics_releases_project_id_analytics_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analytics_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_releases_unique_idx" ON "analytics_releases" USING btree ("project_id","environment","version");--> statement-breakpoint
CREATE INDEX "analytics_releases_project_deployed_idx" ON "analytics_releases" USING btree ("project_id","deployed_at");