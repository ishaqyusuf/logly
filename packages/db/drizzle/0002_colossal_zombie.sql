CREATE TABLE "analytics_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "analytics_organizations" ("id", "slug", "name")
VALUES ('00000000-0000-4000-8000-000000000001', 'personal', 'Personal');--> statement-breakpoint
ALTER TABLE "analytics_projects" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
UPDATE "analytics_projects"
SET "organization_id" = '00000000-0000-4000-8000-000000000001'
WHERE "organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "analytics_projects" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_organizations_slug_idx" ON "analytics_organizations" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "analytics_projects" ADD CONSTRAINT "analytics_projects_organization_id_analytics_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."analytics_organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_projects_organization_idx" ON "analytics_projects" USING btree ("organization_id");
