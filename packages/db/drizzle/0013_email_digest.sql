CREATE TABLE "analytics_email_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"project_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"provider_message_id" text,
	"error" text,
	"claimed_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_email_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid,
	"project_id" uuid,
	"weekly_digest" boolean DEFAULT false NOT NULL,
	"tracking_alerts" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_email_subscriptions_scope_check" CHECK (("analytics_email_subscriptions"."organization_id" is null) <> ("analytics_email_subscriptions"."project_id" is null))
);
--> statement-breakpoint
ALTER TABLE "analytics_email_sends" ADD CONSTRAINT "analytics_email_sends_project_id_analytics_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analytics_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_email_sends" ADD CONSTRAINT "analytics_email_sends_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_email_subscriptions" ADD CONSTRAINT "analytics_email_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_email_subscriptions" ADD CONSTRAINT "analytics_email_subscriptions_organization_id_analytics_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."analytics_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_email_subscriptions" ADD CONSTRAINT "analytics_email_subscriptions_project_id_analytics_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."analytics_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_email_sends_unique_idx" ON "analytics_email_sends" USING btree ("kind","project_id","period_key","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_email_subscriptions_user_org_idx" ON "analytics_email_subscriptions" USING btree ("user_id","organization_id") WHERE "analytics_email_subscriptions"."organization_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_email_subscriptions_user_project_idx" ON "analytics_email_subscriptions" USING btree ("user_id","project_id") WHERE "analytics_email_subscriptions"."project_id" is not null;