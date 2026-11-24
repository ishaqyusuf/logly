import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("account_issuer_account_id_idx").on(
      table.issuer,
      table.accountId,
    ),
    index("account_user_id_idx").on(table.userId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_user_id_idx").on(table.userId),
    uniqueIndex("passkey_credential_id_idx").on(table.credentialID),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  passkeys: many(passkey),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, {
    fields: [passkey.userId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const analyticsOrganizations = pgTable(
  "analytics_organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("analytics_organizations_slug_idx").on(table.slug)],
);

export const analyticsProjects = pgTable(
  "analytics_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => analyticsOrganizations.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    allowedOrigins: jsonb("allowed_origins")
      .$type<string[]>()
      .notNull()
      .default([]),
    eventCatalog: jsonb("event_catalog")
      .$type<string[]>()
      .notNull()
      .default([]),
    timezone: text("timezone").notNull().default("UTC"),
    consentMode: text("consent_mode").notNull().default("required"),
    retentionDays: integer("retention_days").notNull().default(90),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("analytics_projects_slug_idx").on(table.slug),
    index("analytics_projects_organization_idx").on(table.organizationId),
  ],
);

export const analyticsProjectKeys = pgTable(
  "analytics_project_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => analyticsProjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    scope: text("scope").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("analytics_project_keys_project_idx").on(table.projectId)],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => analyticsProjects.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").notNull(),
    name: text("name").notNull(),
    version: integer("version").notNull().default(1),
    source: text("source").notNull(),
    platform: text("platform"),
    appVersion: text("app_version"),
    appBuild: text("app_build"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    visitorKey: text("visitor_key"),
    actorId: text("actor_id"),
    groups: jsonb("groups")
      .$type<import("@logly/utils").EventGroups>()
      .notNull()
      .default({}),
    visitKind: text("visit_kind"),
    route: text("route"),
    referrerHost: text("referrer_host"),
    country: text("country"),
    properties: jsonb("properties")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    campaign: jsonb("campaign").$type<Record<string, string | undefined>>(),
  },
  (table) => [
    uniqueIndex("analytics_events_project_event_idx").on(
      table.projectId,
      table.eventId,
    ),
    index("analytics_events_project_occurred_idx").on(
      table.projectId,
      table.occurredAt,
    ),
    index("analytics_events_project_name_idx").on(table.projectId, table.name),
    // Breakdown reads: name-filtered windows and JSON property containment.
    index("analytics_events_project_name_occurred_idx").on(
      table.projectId,
      table.name,
      table.occurredAt,
    ),
    index("analytics_events_properties_idx").using(
      "gin",
      table.properties.op("jsonb_path_ops"),
    ),
    index("analytics_events_groups_idx").using("gin", table.groups),
    index("analytics_events_project_actor_idx").on(
      table.projectId,
      table.actorId,
      table.occurredAt,
    ),
  ],
);

export const analyticsDailyRollups = pgTable(
  "analytics_daily_rollups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => analyticsProjects.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    metric: text("metric").notNull(),
    dimension: text("dimension").notNull().default("all"),
    dimensionValue: text("dimension_value").notNull().default("all"),
    value: integer("value").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("analytics_daily_rollups_unique_idx").on(
      table.projectId,
      table.day,
      table.metric,
      table.dimension,
      table.dimensionValue,
    ),
  ],
);

/**
 * Latest tracking-quiet evaluation per project. `evaluated_at` doubles as the
 * evaluation claim: an upsert only re-claims a project once its row is stale,
 * so overlapping dashboard reads never evaluate the same project twice.
 */
export const analyticsTrackingAlertState = pgTable(
  "analytics_tracking_alert_state",
  {
    projectId: uuid("project_id")
      .primaryKey()
      .references(() => analyticsProjects.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    observedEvents: integer("observed_events").notNull().default(0),
    baselineEvents: integer("baseline_events").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true }),
    windowEnd: timestamp("window_end", { withTimezone: true }),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

/** Tracking-quiet alert history; at most one open alert per project. */
export const analyticsTrackingAlerts = pgTable(
  "analytics_tracking_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => analyticsProjects.id, { onDelete: "cascade" }),
    severity: text("severity").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    observedEvents: integer("observed_events").notNull(),
    baselineEvents: integer("baseline_events").notNull(),
  },
  (table) => [
    uniqueIndex("analytics_tracking_alerts_open_idx")
      .on(table.projectId)
      .where(sql`${table.resolvedAt} is null`),
    index("analytics_tracking_alerts_project_opened_idx").on(
      table.projectId,
      table.openedAt,
    ),
  ],
);

/**
 * Product releases (deploy markers). One row per project, environment and
 * version; re-posting the same release is a no-op, so CI retries are safe.
 */
export const analyticsReleases = pgTable(
  "analytics_releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => analyticsProjects.id, { onDelete: "cascade" }),
    environment: text("environment").notNull(),
    version: text("version").notNull(),
    deployedAt: timestamp("deployed_at", { withTimezone: true }).notNull(),
    description: text("description"),
    url: text("url"),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("analytics_releases_unique_idx").on(
      table.projectId,
      table.environment,
      table.version,
    ),
    index("analytics_releases_project_deployed_idx").on(
      table.projectId,
      table.deployedAt,
    ),
  ],
);

// Saved funnels (feature 6): an ordered step list and conversion window per
// project. The date range is chosen when the funnel is viewed.
export const analyticsFunnels = pgTable(
  "analytics_funnels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => analyticsProjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    steps: jsonb("steps")
      .$type<import("@logly/utils").FunnelStep[]>()
      .notNull(),
    conversionWindow: text("conversion_window").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("analytics_funnels_project_name_idx").on(
      table.projectId,
      table.name,
    ),
  ],
);

// Event catalog metadata (feature 7): operator notes per event name. Event
// names themselves are discovered from analytics_events; a row here never
// renames, merges or deletes event data. `hidden` only removes the name from
// pickers; `deprecated` adds a badge.
export const analyticsEventCatalog = pgTable(
  "analytics_event_catalog",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => analyticsProjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    notes: text("notes").notNull().default(""),
    deprecated: boolean("deprecated").notNull().default(false),
    hidden: boolean("hidden").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.name] })],
);

// Email channel (feature 8). Admin-managed opt-ins: one row per operator and
// project or organization. Addresses live only in the auth `user` table.
export const analyticsEmailSubscriptions = pgTable(
  "analytics_email_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(
      () => analyticsOrganizations.id,
      { onDelete: "cascade" },
    ),
    projectId: uuid("project_id").references(() => analyticsProjects.id, {
      onDelete: "cascade",
    }),
    weeklyDigest: boolean("weekly_digest").notNull().default(false),
    trackingAlerts: boolean("tracking_alerts").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "analytics_email_subscriptions_scope_check",
      sql`(${table.organizationId} is null) <> (${table.projectId} is null)`,
    ),
    uniqueIndex("analytics_email_subscriptions_user_org_idx")
      .on(table.userId, table.organizationId)
      .where(sql`${table.organizationId} is not null`),
    uniqueIndex("analytics_email_subscriptions_user_project_idx")
      .on(table.userId, table.projectId)
      .where(sql`${table.projectId} is not null`),
  ],
);

/**
 * Email send log and idempotency claim: one row per kind, project, period
 * (digest week or alert id) and recipient. Never stores the address.
 */
export const analyticsEmailSends = pgTable(
  "analytics_email_sends",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => analyticsProjects.id, { onDelete: "cascade" }),
    periodKey: text("period_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("sending"),
    attempts: integer("attempts").notNull().default(1),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("analytics_email_sends_unique_idx").on(
      table.kind,
      table.projectId,
      table.periodKey,
      table.userId,
    ),
  ],
);
