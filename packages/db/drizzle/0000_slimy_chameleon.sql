CREATE TABLE "analytics_daily_rollups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"day" text NOT NULL,
	"metric" text NOT NULL,
	"dimension" text DEFAULT 'all' NOT NULL,
	"dimension_value" text DEFAULT 'all' NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"source" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visitor_key" text,
	"actor_id" text,
	"visit_kind" text,
	"route" text,
	"referrer_host" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"campaign" jsonb
);
--> statement-breakpoint
CREATE TABLE "analytics_project_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"event_catalog" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"consent_mode" text DEFAULT 'required' NOT NULL,
	"retention_days" integer DEFAULT 90 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_daily_rollups" ADD CONSTRAINT "analytics_daily_rollups_project_id_analytics_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analytics_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_project_id_analytics_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analytics_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_project_keys" ADD CONSTRAINT "analytics_project_keys_project_id_analytics_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analytics_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_rollups_unique_idx" ON "analytics_daily_rollups" USING btree ("project_id","day","metric","dimension","dimension_value");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_events_project_event_idx" ON "analytics_events" USING btree ("project_id","event_id");--> statement-breakpoint
CREATE INDEX "analytics_events_project_occurred_idx" ON "analytics_events" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_project_name_idx" ON "analytics_events" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "analytics_project_keys_project_idx" ON "analytics_project_keys" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_projects_slug_idx" ON "analytics_projects" USING btree ("slug");