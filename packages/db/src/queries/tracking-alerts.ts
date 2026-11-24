import {
  assessTrackingQuiet,
  TRACKING_ALERT_EVALUATE_EVERY_MINUTES,
  type TrackingAlertSeverity,
  type TrackingAlertState,
  type TrackingAlertStatus,
  type TrackingAlertsReport,
  trackingAlertWindows,
} from "@logly/utils";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { type Database, getDatabase } from "../client";
import {
  analyticsProjects,
  analyticsTrackingAlertState,
  analyticsTrackingAlerts,
} from "../schema";

/** Upper bound a read waits for evaluation (the admin read client times out at 4s). */
export const TRACKING_ALERT_EVALUATION_TIMEOUT_MS = 1_500;

const iso = (value: Date | string | null) =>
  value === null ? null : new Date(value).toISOString();

/**
 * Claim every enabled project whose state is missing or older than the
 * evaluation interval. The upsert is atomic per row, so concurrent callers
 * split the projects between them and never evaluate one project twice.
 */
async function claimStaleProjects(db: Database, now: Date) {
  const staleBefore = new Date(
    now.getTime() - TRACKING_ALERT_EVALUATE_EVERY_MINUTES * 60_000,
  ).toISOString();
  const nowIso = now.toISOString();
  const rows = await db.execute<{ project_id: string }>(sql`
    insert into analytics_tracking_alert_state (project_id, evaluated_at)
    select id, ${nowIso}::timestamptz from analytics_projects where enabled
    on conflict (project_id) do update set evaluated_at = excluded.evaluated_at
      where analytics_tracking_alert_state.evaluated_at < ${staleBefore}::timestamptz
    returning project_id
  `);
  return rows.map((row) => row.project_id);
}

/** Event counts for the recent window and each previous same-hour window. */
async function countWindows(db: Database, projectIds: string[], now: Date) {
  const windows = trackingAlertWindows(now);
  const values = sql.join(
    windows.map(
      (window) =>
        sql`(${window.day}::int, ${window.start.toISOString()}::timestamptz, ${window.end.toISOString()}::timestamptz)`,
    ),
    sql`, `,
  );
  const rows = await db.execute<{
    project_id: string;
    day: number;
    events: number;
  }>(sql`
    select p.id as project_id, w.day,
      (select count(*)::int from analytics_events e
        where e.project_id = p.id
          and e.occurred_at >= w.start_at and e.occurred_at < w.end_at) as events
    from analytics_projects p
    cross join (values ${values}) as w(day, start_at, end_at)
    where p.id in (${sql.join(
      projectIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
  `);
  const byProject = new Map<string, number[]>();
  for (const row of rows) {
    const counts =
      byProject.get(row.project_id) ?? Array(windows.length).fill(0);
    counts[row.day] = row.events;
    byProject.set(row.project_id, counts);
  }
  return { windows, byProject };
}

/**
 * Evaluate tracking-quiet alerts for every stale project. Triggered by
 * dashboard reads (overview and alert endpoints), at most once per project
 * per `TRACKING_ALERT_EVALUATE_EVERY_MINUTES`. Idempotent: the open alert is
 * protected by a partial unique index, so a repeated or concurrent decision
 * cannot open a second alert.
 */
export async function evaluateTrackingAlerts(
  now = new Date(),
  db: Database | null = getDatabase(),
) {
  if (!db) return { evaluated: 0 };
  const projectIds = await claimStaleProjects(db, now);
  if (!projectIds.length) return { evaluated: 0 };
  const [{ windows, byProject }, openAlerts] = await Promise.all([
    countWindows(db, projectIds, now),
    db
      .select({
        id: analyticsTrackingAlerts.id,
        projectId: analyticsTrackingAlerts.projectId,
        severity: analyticsTrackingAlerts.severity,
      })
      .from(analyticsTrackingAlerts)
      .where(
        and(
          inArray(analyticsTrackingAlerts.projectId, projectIds),
          isNull(analyticsTrackingAlerts.resolvedAt),
        ),
      ),
  ]);
  const recent = windows[0];
  if (!recent) return { evaluated: 0 };
  const open = new Map(openAlerts.map((alert) => [alert.projectId, alert]));

  for (const projectId of projectIds) {
    const counts = byProject.get(projectId) ?? [];
    const observed = counts[0] ?? 0;
    const alert = open.get(projectId);
    const decision = assessTrackingQuiet({
      observed,
      samples: counts.slice(1),
      open: (alert?.severity as TrackingAlertSeverity | undefined) ?? null,
    });
    const { action } = decision;
    if (action.type === "open") {
      await db
        .insert(analyticsTrackingAlerts)
        .values({
          projectId,
          severity: action.severity,
          openedAt: now,
          observedEvents: observed,
          baselineEvents: decision.baseline,
        })
        .onConflictDoNothing();
    } else if (action.type === "update" && alert) {
      await db
        .update(analyticsTrackingAlerts)
        .set({ severity: action.severity })
        .where(eq(analyticsTrackingAlerts.id, alert.id));
    } else if (action.type === "resolve" && alert) {
      await db
        .update(analyticsTrackingAlerts)
        .set({ resolvedAt: now })
        .where(
          and(
            eq(analyticsTrackingAlerts.id, alert.id),
            isNull(analyticsTrackingAlerts.resolvedAt),
          ),
        );
    }
    await db
      .update(analyticsTrackingAlertState)
      .set({
        status: decision.status,
        observedEvents: observed,
        baselineEvents: decision.baseline,
        windowStart: recent.start,
        windowEnd: recent.end,
        evaluatedAt: now,
      })
      .where(eq(analyticsTrackingAlertState.projectId, projectId));
  }
  return { evaluated: projectIds.length };
}

/**
 * Bounded, failure-tolerant evaluation for read paths: an evaluation error or
 * timeout never fails the dashboard read; the next stale read retries.
 */
export async function refreshTrackingAlerts(now = new Date()) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      evaluateTrackingAlerts(now),
      new Promise((resolve) => {
        timer = setTimeout(resolve, TRACKING_ALERT_EVALUATION_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error("Tracking alert evaluation failed", error);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toState(
  row:
    | {
        status: string;
        observedEvents: number;
        baselineEvents: number;
        windowStart: Date | string | null;
        windowEnd: Date | string | null;
        evaluatedAt: Date | string | null;
        openedAt: Date | string | null;
      }
    | undefined,
): TrackingAlertState {
  return {
    status: (row?.status as TrackingAlertStatus | undefined) ?? "pending",
    observedEvents: row?.observedEvents ?? 0,
    baselineEvents: row?.baselineEvents ?? 0,
    windowStart: iso(row?.windowStart ?? null),
    windowEnd: iso(row?.windowEnd ?? null),
    evaluatedAt: iso(row?.evaluatedAt ?? null),
    openedAt: iso(row?.openedAt ?? null),
  };
}

/** Stored alert state for the given projects (no evaluation). */
export async function listTrackingAlertStates(
  projectIds: string[],
  db: Database | null = getDatabase(),
) {
  const states = new Map<string, TrackingAlertState>();
  if (!db || !projectIds.length) return states;
  const rows = await db
    .select({
      projectId: analyticsTrackingAlertState.projectId,
      status: analyticsTrackingAlertState.status,
      observedEvents: analyticsTrackingAlertState.observedEvents,
      baselineEvents: analyticsTrackingAlertState.baselineEvents,
      windowStart: analyticsTrackingAlertState.windowStart,
      windowEnd: analyticsTrackingAlertState.windowEnd,
      evaluatedAt: analyticsTrackingAlertState.evaluatedAt,
      openedAt: analyticsTrackingAlerts.openedAt,
    })
    .from(analyticsTrackingAlertState)
    .leftJoin(
      analyticsTrackingAlerts,
      and(
        eq(
          analyticsTrackingAlerts.projectId,
          analyticsTrackingAlertState.projectId,
        ),
        isNull(analyticsTrackingAlerts.resolvedAt),
      ),
    )
    .where(inArray(analyticsTrackingAlertState.projectId, projectIds));
  for (const row of rows) states.set(row.projectId, toState(row));
  return states;
}

export const TRACKING_ALERT_HISTORY_LIMIT = 20;

/** State plus the most recent alert history for one project. */
export async function getTrackingAlertsReport(
  query: { project: string },
  db: Database | null = getDatabase(),
): Promise<TrackingAlertsReport | null> {
  if (!db) return { state: toState(undefined), history: [] };
  const [project] = await db
    .select({ id: analyticsProjects.id })
    .from(analyticsProjects)
    .where(eq(analyticsProjects.slug, query.project))
    .limit(1);
  if (!project) return null;
  const [states, history] = await Promise.all([
    listTrackingAlertStates([project.id], db),
    db
      .select()
      .from(analyticsTrackingAlerts)
      .where(eq(analyticsTrackingAlerts.projectId, project.id))
      .orderBy(desc(analyticsTrackingAlerts.openedAt))
      .limit(TRACKING_ALERT_HISTORY_LIMIT),
  ]);
  return {
    state: states.get(project.id) ?? toState(undefined),
    history: history.map((row) => ({
      id: row.id,
      severity: row.severity as TrackingAlertSeverity,
      openedAt: iso(row.openedAt) as string,
      resolvedAt: iso(row.resolvedAt),
      observedEvents: row.observedEvents,
      baselineEvents: row.baselineEvents,
    })),
  };
}
