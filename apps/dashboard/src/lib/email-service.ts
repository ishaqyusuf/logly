import {
  claimEmailSend,
  type EmailProjectRow,
  evaluateTrackingAlerts,
  finishEmailSend,
  getWeeklyDigestMetrics,
  listAlertTransitions,
  listDigestProjects,
  listEmailRecipients,
} from "@logly/db/queries";
import {
  type DigestData,
  type DigestWeek,
  type EmailJobStore,
  type EmailTransport,
  emailTransportFromEnv,
  pickEventMovers,
  unsubscribeKey,
} from "@logly/email";

/**
 * Dashboard wiring for the email channel: the `@logly/email` job and
 * renderers over `@logly/db` queries, configured from the environment.
 */

/** Public dashboard origin used in email links; null when unconfigured. */
export function emailBaseUrl(
  env: Record<string, string | undefined> = process.env,
) {
  for (const value of [env.NEXT_PUBLIC_DASHBOARD_URL, env.BETTER_AUTH_URL]) {
    try {
      if (value?.trim()) return new URL(value.trim()).origin;
    } catch {}
  }
  return null;
}

export function emailUnsubscribeKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  return secret ? unsubscribeKey(secret) : null;
}

export function emailTransport(): EmailTransport {
  return emailTransportFromEnv(process.env);
}

export async function buildDigestData(
  project: Pick<EmailProjectRow, "id" | "slug" | "name"> & {
    organization: { name: string; slug: string };
  },
  week: DigestWeek,
): Promise<DigestData> {
  const metrics = await getWeeklyDigestMetrics(project, week);
  return {
    project: { name: project.name, slug: project.slug },
    organization: {
      name: project.organization.name,
      slug: project.organization.slug,
    },
    week,
    visitors: metrics.visitors,
    events: metrics.events,
    pages: metrics.pages,
    movers: pickEventMovers(metrics.eventCounts),
    releases: metrics.releases,
    alerts: metrics.alerts,
  };
}

export const emailJobStore: EmailJobStore = {
  async evaluateAlerts(now) {
    await evaluateTrackingAlerts(now);
  },
  listDigestProjects: () => listDigestProjects(),
  listRecipients: (projectId, kind) => listEmailRecipients(projectId, kind),
  loadDigest: (project, week) => buildDigestData(project, week),
  listAlertTransitions: (since) => listAlertTransitions(since),
  claimSend: (input) => claimEmailSend(input),
  finishSend: (id, result, now) => finishEmailSend(id, result, now),
};
