CREATE TABLE "analytics_funnels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"steps" jsonb NOT NULL,
	"conversion_window" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_funnels" ADD CONSTRAINT "analytics_funnels_project_id_analytics_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analytics_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_funnels_project_name_idx" ON "analytics_funnels" USING btree ("project_id","name");