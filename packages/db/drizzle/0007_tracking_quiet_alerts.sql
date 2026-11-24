CREATE TABLE "analytics_tracking_alert_state" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"observed_events" integer DEFAULT 0 NOT NULL,
	"baseline_events" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone,
	"window_end" timestamp with time zone,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_tracking_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"severity" text NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"observed_events" integer NOT NULL,
	"baseline_events" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_tracking_alert_state" ADD CONSTRAINT "analytics_tracking_alert_state_project_id_analytics_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analytics_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_tracking_alerts" ADD CONSTRAINT "analytics_tracking_alerts_project_id_analytics_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analytics_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_tracking_alerts_open_idx" ON "analytics_tracking_alerts" USING btree ("project_id") WHERE "analytics_tracking_alerts"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "analytics_tracking_alerts_project_opened_idx" ON "analytics_tracking_alerts" USING btree ("project_id","opened_at");