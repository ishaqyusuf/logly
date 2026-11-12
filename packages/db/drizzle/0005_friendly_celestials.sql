ALTER TABLE "analytics_events" ADD COLUMN "groups" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "analytics_events_groups_idx" ON "analytics_events" USING gin ("groups");--> statement-breakpoint
CREATE INDEX "analytics_events_project_actor_idx" ON "analytics_events" USING btree ("project_id","actor_id","occurred_at");