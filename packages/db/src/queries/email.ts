import { sql } from "drizzle-orm";
import { type Database, getDatabase } from "../client";
import { getDashboardPages } from "./pages";
import { listReleases } from "./releases";

/**
 * Email channel persistence (feature 8): admin-managed subscriptions, the
 * per-send idempotency claim, and the weekly digest's metrics. Addresses are
 * read from the auth `user` table at send time and never copied.
 */

export type EmailSubscriptionKind = "digest" | "alerts";
export type EmailSendKind = "digest" | "alert_opened" | "alert_resolved";
export type EmailSendOutcome =
  | { status: "sent"; id: string | null }
  | { status: "failed"; error: string; retryable: boolean };

/** Failed sends are retried until this many attempts. */
export const EMAIL_SEND_MAX_ATTEMPTS = 3;
/** A claim left in `sending` this long is treated as crashed and retried. */
export const EMAIL_SEND_STALE_MINUTES = 15;
const OPERATOR_LIMIT = 100;
const ALERT_TRANSITION_LIMIT = 100;

const required = (db: Database | null) => {
  if (!db) throw new Error("Email requires the analytics database");
  return db;
};
const iso = (value: Date | string) => new Date(value).toISOString();
const flag = (kind: EmailSubscriptionKind) =>
  kind === "digest" ? sql`s.weekly_digest` : sql`s.tracking_alerts`;

export type EmailProjectRow = {
  id: string;
  slug: string;
  name: string;
  timeZone: string;
  organization: { id: string; name: string; slug: string };
};

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
};

const toProject = (row: ProjectRow): EmailProjectRow => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  timeZone: row.timezone,
  organization: {
    id: row.organization_id,
    name: row.organization_name,
    slug: row.organization_slug,
  },
});

const projectColumns = sql`p.id, p.slug, p.name, p.timezone,
  o.id as organization_id, o.name as organization_name, o.slug as organization_slug`;

export async function getEmailProject(
  slug: string,
  db: Database | null = getDatabase(),
) {
  const rows = await required(db).execute<ProjectRow>(sql`
    select ${projectColumns}
    from analytics_projects p
    join analytics_organizations o on o.id = p.organization_id
    where p.slug = ${slug}
    limit 1
  `);
  return rows[0] ? toProject(rows[0]) : null;
}

export type EmailOperatorSubscriptions = {
  userId: string;
  name: string;
  email: string;
  role: string;
  project: { digest: boolean; alerts: boolean };
  organization: { digest: boolean; alerts: boolean };
};

/** Operators and their opt-ins for one project and its organization. */
export async function listEmailSubscriptions(
  project: { id: string; organizationId: string },
  db: Database | null = getDatabase(),
): Promise<EmailOperatorSubscriptions[]> {
  const rows = await required(db).execute<{
    id: string;
    name: string;
    email: string;
    role: string;
    project_digest: boolean | null;
    project_alerts: boolean | null;
    organization_digest: boolean | null;
    organization_alerts: boolean | null;
  }>(sql`
    select u.id, u.name, u.email, u.role,
      ps.weekly_digest as project_digest, ps.tracking_alerts as project_alerts,
      os.weekly_digest as organization_digest, os.tracking_alerts as organization_alerts
    from "user" u
    left join analytics_email_subscriptions ps
      on ps.user_id = u.id and ps.project_id = ${project.id}::uuid
    left join analytics_email_subscriptions os
      on os.user_id = u.id and os.organization_id = ${project.organizationId}::uuid
    where not u.banned
    order by u.created_at, u.id
    limit ${OPERATOR_LIMIT}
  `);
  return rows.map((row) => ({
    userId: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    project: {
      digest: row.project_digest ?? false,
      alerts: row.project_alerts ?? false,
    },
    organization: {
      digest: row.organization_digest ?? false,
      alerts: row.organization_alerts ?? false,
    },
  }));
}

export type SetEmailSubscriptionInput = {
  userId: string;
  scope: { projectId: string } | { organizationId: string };
  weeklyDigest: boolean;
  trackingAlerts: boolean;
};

/** Upsert one opt-in row; a row with both kinds off is deleted. */
export async function setEmailSubscription(
  input: SetEmailSubscriptionInput,
  db: Database | null = getDatabase(),
) {
  const database = required(db);
  const projectId = "projectId" in input.scope ? input.scope.projectId : null;
  const organizationId =
    "organizationId" in input.scope ? input.scope.organizationId : null;
  const [operator] = await database.execute<{ id: string }>(sql`
    select id from "user" where id = ${input.userId} and not banned limit 1
  `);
  if (!operator) return { status: "user_not_found" as const };
  const scope = projectId
    ? sql`project_id = ${projectId}::uuid`
    : sql`organization_id = ${organizationId}::uuid`;
  if (!input.weeklyDigest && !input.trackingAlerts) {
    await database.execute(sql`
      delete from analytics_email_subscriptions
      where user_id = ${input.userId} and ${scope}
    `);
    return { status: "removed" as const };
  }
  const conflict = projectId
    ? sql`(user_id, project_id) where project_id is not null`
    : sql`(user_id, organization_id) where organization_id is not null`;
  await database.execute(sql`
    insert into analytics_email_subscriptions
      (user_id, organization_id, project_id, weekly_digest, tracking_alerts)
    values (${input.userId}, ${organizationId}::uuid, ${projectId}::uuid,
      ${input.weeklyDigest}, ${input.trackingAlerts})
    on conflict ${conflict} do update set
      weekly_digest = excluded.weekly_digest,
      tracking_alerts = excluded.tracking_alerts,
      updated_at = now()
  `);
  return { status: "saved" as const };
}

/**
 * Unsubscribe from a signed link. An organization-level row turns the kind
 * off for that operator across the organization (its row and every project
 * row in it); a project-level row turns off only that project.
 */
export async function unsubscribeEmail(
  input: { subscriptionId: string; kind: EmailSubscriptionKind },
  db: Database | null = getDatabase(),
) {
  const database = required(db);
  const [row] = await database.execute<{
    user_id: string;
    organization_id: string | null;
    project_id: string | null;
    scope_name: string;
  }>(sql`
    select s.user_id, s.organization_id, s.project_id,
      coalesce(p.name, o.name) as scope_name
    from analytics_email_subscriptions s
    left join analytics_projects p on p.id = s.project_id
    left join analytics_organizations o on o.id = s.organization_id
    where s.id = ${input.subscriptionId}::uuid
  `);
  if (!row) return null;
  const column =
    input.kind === "digest" ? sql`weekly_digest` : sql`tracking_alerts`;
  const target = row.organization_id
    ? sql`(organization_id = ${row.organization_id}::uuid
        or project_id in (select id from analytics_projects
          where organization_id = ${row.organization_id}::uuid))`
    : sql`project_id = ${row.project_id}::uuid`;
  await database.execute(sql`
    update analytics_email_subscriptions set ${column} = false, updated_at = now()
    where user_id = ${row.user_id} and ${target}
  `);
  await database.execute(sql`
    delete from analytics_email_subscriptions
    where user_id = ${row.user_id} and ${target}
      and not weekly_digest and not tracking_alerts
  `);
  return {
    scope: row.organization_id
      ? ("organization" as const)
      : ("project" as const),
    name: row.scope_name,
  };
}

export type EmailRecipientRow = {
  subscriptionId: string;
  userId: string;
  email: string;
};

/**
 * One row per operator subscribed to the project directly or through its
 * organization. The organization row wins, so its unsubscribe link covers
 * every path the operator receives this project's mail through.
 */
export async function listEmailRecipients(
  projectId: string,
  kind: EmailSubscriptionKind,
  db: Database | null = getDatabase(),
): Promise<EmailRecipientRow[]> {
  const rows = await required(db).execute<{
    subscription_id: string;
    user_id: string;
    email: string;
  }>(sql`
    select distinct on (u.id) s.id as subscription_id, u.id as user_id, u.email
    from analytics_projects p
    join analytics_email_subscriptions s
      on s.project_id = p.id or s.organization_id = p.organization_id
    join "user" u on u.id = s.user_id
    where p.id = ${projectId}::uuid and p.enabled and ${flag(kind)}
      and not u.banned
    order by u.id, s.organization_id nulls last
  `);
  return rows.map((row) => ({
    subscriptionId: row.subscription_id,
    userId: row.user_id,
    email: row.email,
  }));
}

/** Enabled projects with at least one weekly-digest recipient. */
export async function listDigestProjects(db: Database | null = getDatabase()) {
  const rows = await required(db).execute<ProjectRow>(sql`
    select ${projectColumns}
    from analytics_projects p
    join analytics_organizations o on o.id = p.organization_id
    where p.enabled and exists (
      select 1 from analytics_email_subscriptions s
      join "user" u on u.id = s.user_id
      where (s.project_id = p.id or s.organization_id = p.organization_id)
        and s.weekly_digest and not u.banned
    )
    order by o.slug, p.slug
  `);
  return rows.map(toProject);
}

export type AlertTransitionRow = {
  alertId: string;
  transition: "opened" | "resolved";
  severity: string;
  openedAt: string;
  resolvedAt: string | null;
  observedEvents: number;
  baselineEvents: number;
  project: EmailProjectRow;
};

/** Alerts opened or resolved since `since`, oldest first, bounded. */
export async function listAlertTransitions(
  since: Date,
  db: Database | null = getDatabase(),
): Promise<AlertTransitionRow[]> {
  const rows = await required(db).execute<
    ProjectRow & {
      alert_id: string;
      transition: "opened" | "resolved";
      at: Date | string;
      severity: string;
      opened_at: Date | string;
      resolved_at: Date | string | null;
      observed_events: number;
      baseline_events: number;
    }
  >(sql`
    with transitions as (
      select a.*, 'opened'::text as transition, a.opened_at as at
      from analytics_tracking_alerts a where a.opened_at >= ${since.toISOString()}::timestamptz
      union all
      select a.*, 'resolved'::text, a.resolved_at
      from analytics_tracking_alerts a where a.resolved_at >= ${since.toISOString()}::timestamptz
    )
    select t.id as alert_id, t.transition, t.at, t.severity, t.opened_at,
      t.resolved_at, t.observed_events, t.baseline_events, ${projectColumns}
    from transitions t
    join analytics_projects p on p.id = t.project_id
    join analytics_organizations o on o.id = p.organization_id
    where p.enabled
    order by t.at, t.id
    limit ${ALERT_TRANSITION_LIMIT}
  `);
  return rows.map((row) => ({
    alertId: row.alert_id,
    transition: row.transition,
    severity: row.severity,
    openedAt: iso(row.opened_at),
    resolvedAt: row.resolved_at ? iso(row.resolved_at) : null,
    observedEvents: row.observed_events,
    baselineEvents: row.baseline_events,
    project: toProject(row),
  }));
}

/**
 * Claim one send. Inserts the row, or re-claims a retryable failure under
 * the attempt cap or a stale `sending` claim. Concurrent claimers serialize
 * on the unique index, so exactly one of them gets the id.
 */
export async function claimEmailSend(
  input: {
    kind: EmailSendKind;
    projectId: string;
    periodKey: string;
    userId: string;
    now: Date;
  },
  db: Database | null = getDatabase(),
) {
  const now = input.now.toISOString();
  const rows = await required(db).execute<{ id: string }>(sql`
    insert into analytics_email_sends
      (kind, project_id, period_key, user_id, status, attempts, claimed_at)
    values (${input.kind}, ${input.projectId}::uuid, ${input.periodKey},
      ${input.userId}, 'sending', 1, ${now}::timestamptz)
    on conflict (kind, project_id, period_key, user_id) do update set
      status = 'sending',
      attempts = analytics_email_sends.attempts + 1,
      claimed_at = excluded.claimed_at,
      error = null
    where (analytics_email_sends.status = 'failed'
        and analytics_email_sends.attempts < ${EMAIL_SEND_MAX_ATTEMPTS})
      or (analytics_email_sends.status = 'sending'
        and analytics_email_sends.claimed_at
          < excluded.claimed_at - make_interval(mins => ${EMAIL_SEND_STALE_MINUTES}))
    returning id
  `);
  return rows[0]?.id ?? null;
}

/** Record the outcome: `sent`, `failed` (retryable) or `rejected`. */
export async function finishEmailSend(
  id: string,
  result: EmailSendOutcome,
  now: Date,
  db: Database | null = getDatabase(),
) {
  const status =
    result.status === "sent"
      ? "sent"
      : result.retryable
        ? "failed"
        : "rejected";
  await required(db).execute(sql`
    update analytics_email_sends set
      status = ${status},
      provider_message_id = ${result.status === "sent" ? result.id : null},
      error = ${result.status === "failed" ? result.error.slice(0, 300) : null},
      sent_at = ${result.status === "sent" ? now.toISOString() : null}::timestamptz
    where id = ${id}::uuid
  `);
}

export type WeeklyDigestMetrics = {
  visitors: { current: number; previous: number };
  events: { current: number; previous: number };
  pages: {
    view: "page_view" | "screen_view";
    rows: Array<{ route: string | null; views: number; previousViews: number }>;
  };
  eventCounts: Array<{ name: string; count: number; previousCount: number }>;
  releases: Array<{ version: string; environment: string; deployedAt: string }>;
  alerts: Array<{
    severity: string;
    openedAt: string;
    resolvedAt: string | null;
  }>;
};

export const DIGEST_EVENT_CANDIDATES = 20;
const DIGEST_RELEASE_LIMIT = 10;
const DIGEST_ALERT_LIMIT = 10;

/**
 * Metrics for one project and week. Reuses the Pages report (top 5 routes)
 * and the release list; totals, event changes and alerts are three bounded
 * queries on `(project_id, occurred_at)` and the alert index.
 */
export async function getWeeklyDigestMetrics(
  project: { id: string; slug: string },
  window: { start: Date; end: Date; previousStart: Date },
  db: Database | null = getDatabase(),
): Promise<WeeklyDigestMetrics> {
  const database = required(db);
  const start = window.start.toISOString();
  const end = window.end.toISOString();
  const previousStart = window.previousStart.toISOString();
  const [totals, events, pages, releases, alerts] = await Promise.all([
    database.execute<{
      visitors: number;
      previous_visitors: number;
      events: number;
      previous_events: number;
    }>(sql`
      select
        count(distinct visitor_key) filter (where occurred_at >= ${start}::timestamptz)::int as visitors,
        count(distinct visitor_key) filter (where occurred_at < ${start}::timestamptz)::int as previous_visitors,
        count(*) filter (where occurred_at >= ${start}::timestamptz)::int as events,
        count(*) filter (where occurred_at < ${start}::timestamptz)::int as previous_events
      from analytics_events
      where project_id = ${project.id}::uuid
        and occurred_at >= ${previousStart}::timestamptz and occurred_at < ${end}::timestamptz
    `),
    database.execute<{
      name: string;
      count: number;
      previous_count: number;
    }>(sql`
      select name,
        count(*) filter (where occurred_at >= ${start}::timestamptz)::int as count,
        count(*) filter (where occurred_at < ${start}::timestamptz)::int as previous_count
      from analytics_events
      where project_id = ${project.id}::uuid
        and occurred_at >= ${previousStart}::timestamptz and occurred_at < ${end}::timestamptz
      group by name
      order by abs(count(*) filter (where occurred_at >= ${start}::timestamptz)
        - count(*) filter (where occurred_at < ${start}::timestamptz)) desc, name
      limit ${DIGEST_EVENT_CANDIDATES}
    `),
    getDashboardPages({ project: project.slug, range: "7d", window }, database),
    listReleases(
      {
        project: project.slug,
        start: window.start,
        end: window.end,
        limit: DIGEST_RELEASE_LIMIT,
      },
      database,
    ),
    database.execute<{
      severity: string;
      opened_at: Date | string;
      resolved_at: Date | string | null;
    }>(sql`
      select severity, opened_at, resolved_at
      from analytics_tracking_alerts
      where project_id = ${project.id}::uuid
        and ((opened_at >= ${start}::timestamptz and opened_at < ${end}::timestamptz)
          or (resolved_at >= ${start}::timestamptz and resolved_at < ${end}::timestamptz))
      order by opened_at
      limit ${DIGEST_ALERT_LIMIT}
    `),
  ]);
  const total = totals[0];
  return {
    visitors: {
      current: total?.visitors ?? 0,
      previous: total?.previous_visitors ?? 0,
    },
    events: {
      current: total?.events ?? 0,
      previous: total?.previous_events ?? 0,
    },
    pages: {
      view: pages.view,
      rows: pages.pages.slice(0, 5).map((row) => ({
        route: row.route,
        views: row.views,
        previousViews: row.previousViews,
      })),
    },
    eventCounts: events.map((row) => ({
      name: row.name,
      count: row.count,
      previousCount: row.previous_count,
    })),
    releases: [...releases].reverse().map((release) => ({
      version: release.version,
      environment: release.environment,
      deployedAt: release.deployedAt,
    })),
    alerts: alerts.map((row) => ({
      severity: row.severity,
      openedAt: iso(row.opened_at),
      resolvedAt: row.resolved_at ? iso(row.resolved_at) : null,
    })),
  };
}
