CREATE TABLE "analytics_event_catalog" (
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"deprecated" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_event_catalog_project_id_name_pk" PRIMARY KEY("project_id","name")
);
--> statement-breakpoint
ALTER TABLE "analytics_event_catalog" ADD CONSTRAINT "analytics_event_catalog_project_id_analytics_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analytics_projects"("id") ON DELETE cascade ON UPDATE no action;