import {
  type AlertEmailData,
  type DigestData,
  dashboardLink,
  type RenderedEmail,
  renderAlertEmail,
  renderDigestEmail,
} from "./render";
import type { EmailSendResult, EmailTransport } from "./sender";
import {
  createUnsubscribeToken,
  type EmailSubscriptionKind,
} from "./unsubscribe";
import { type DigestWeek, digestWeek } from "./week";

export type EmailSendKind = "digest" | "alert_opened" | "alert_resolved";

export type EmailRecipient = {
  subscriptionId: string;
  userId: string;
  email: string;
};

export type EmailProject = {
  id: string;
  slug: string;
  name: string;
  timeZone: string;
  organization: { name: string; slug: string };
};

export type AlertTransition = Omit<
  AlertEmailData,
  "project" | "organization"
> & {
  alertId: string;
  project: EmailProject;
};

/** Persistence the job needs; the dashboard wires it to `@logly/db`. */
export type EmailJobStore = {
  /** Read-time alert evaluation, reused so email arrives without dashboard reads. */
  evaluateAlerts(now: Date): Promise<void>;
  /** Enabled projects with at least one digest recipient. */
  listDigestProjects(): Promise<EmailProject[]>;
  listRecipients(
    projectId: string,
    kind: EmailSubscriptionKind,
  ): Promise<EmailRecipient[]>;
  loadDigest(project: EmailProject, week: DigestWeek): Promise<DigestData>;
  /** Alerts opened or resolved at or after `since`. */
  listAlertTransitions(since: Date): Promise<AlertTransition[]>;
  /**
   * Claim one send. Returns a send id only when this caller may send now:
   * a new row, a retryable failure under the attempt cap, or a stale claim.
   */
  claimSend(input: {
    kind: EmailSendKind;
    projectId: string;
    periodKey: string;
    userId: string;
    now: Date;
  }): Promise<string | null>;
  finishSend(id: string, result: EmailSendResult, now: Date): Promise<void>;
};

/** Digests go out only this long after the week ends (Monday + one retry day). */
export const DIGEST_SEND_WINDOW_HOURS = 48;
/** Alert transitions older than this are never emailed (no backlog on first deploy). */
export const ALERT_EMAIL_LOOKBACK_HOURS = 48;
/** Per-run cap; leftovers go out on the next run. */
export const EMAIL_JOB_MAX_SENDS = 200;
/** Resend's default limit is 2 requests per second. */
export const EMAIL_SEND_SPACING_MS = 550;
/** Stop claiming new sends this long before the function's 60s limit. */
export const EMAIL_JOB_BUDGET_MS = 45_000;

export type EmailJobSummary = {
  status: "ok" | "disabled";
  reason?: string;
  alerts: { sent: number; failed: number };
  digests: { sent: number; failed: number; projects: number };
  truncated: boolean;
};

export type EmailJobInput = {
  now?: Date;
  store: EmailJobStore;
  transport: EmailTransport;
  baseUrl: string;
  unsubscribeKey: Buffer;
  budgetMs?: number;
  maxSends?: number;
  spacingMs?: number;
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export function unsubscribeUrl(
  baseUrl: string,
  key: Buffer,
  recipient: EmailRecipient,
  kind: EmailSubscriptionKind,
) {
  const url = new URL("/api/email/unsubscribe", baseUrl);
  url.searchParams.set(
    "token",
    createUnsubscribeToken(key, {
      subscriptionId: recipient.subscriptionId,
      kind,
    }),
  );
  return url.toString();
}

/** One-click unsubscribe headers (RFC 8058). */
export function unsubscribeHeaders(url: string) {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * The scheduled email job: evaluate tracking alerts, email alert
 * transitions, then send last week's digest per project. Every send is
 * claimed first, so overlapping or repeated runs never email a recipient
 * twice for the same project and week (or alert transition).
 */
export async function runEmailJob(
  input: EmailJobInput,
): Promise<EmailJobSummary> {
  const now = input.now ?? new Date();
  const clock = input.clock ?? Date.now;
  const started = clock();
  const budget = input.budgetMs ?? EMAIL_JOB_BUDGET_MS;
  const maxSends = input.maxSends ?? EMAIL_JOB_MAX_SENDS;
  const spacing = input.spacingMs ?? EMAIL_SEND_SPACING_MS;
  const sleep =
    input.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const summary: EmailJobSummary = {
    status: "ok",
    alerts: { sent: 0, failed: 0 },
    digests: { sent: 0, failed: 0, projects: 0 },
    truncated: false,
  };

  try {
    await input.store.evaluateAlerts(now);
  } catch (error) {
    console.error("Email job: alert evaluation failed", error);
  }
  if (!input.transport.enabled) {
    return { ...summary, status: "disabled", reason: input.transport.reason };
  }

  let attempted = 0;
  const canSend = () => {
    if (attempted >= maxSends || clock() - started >= budget) {
      summary.truncated = true;
      return false;
    }
    return true;
  };

  async function deliver(
    claim: {
      kind: EmailSendKind;
      projectId: string;
      periodKey: string;
      recipient: EmailRecipient;
    },
    render: () => RenderedEmail | Promise<RenderedEmail>,
    unsubscribe: string,
  ) {
    const id = await input.store.claimSend({
      kind: claim.kind,
      projectId: claim.projectId,
      periodKey: claim.periodKey,
      userId: claim.recipient.userId,
      now,
    });
    if (!id) return null;
    if (attempted > 0 && spacing > 0) await sleep(spacing);
    attempted += 1;
    let result: EmailSendResult;
    try {
      const email = await render();
      result = await input.transport.send({
        to: claim.recipient.email,
        ...email,
        headers: unsubscribeHeaders(unsubscribe),
        idempotencyKey: `logly-email-${id}`,
      });
    } catch (error) {
      result = {
        status: "failed",
        error: String(error instanceof Error ? error.message : error).slice(
          0,
          300,
        ),
        retryable: true,
      };
    }
    await input.store.finishSend(id, result, now);
    return result.status === "sent";
  }

  // 1. Tracking-alert transitions.
  const since = new Date(
    now.getTime() - ALERT_EMAIL_LOOKBACK_HOURS * 3_600_000,
  );
  const transitions = await input.store.listAlertTransitions(since);
  const alertRecipients = new Map<string, EmailRecipient[]>();
  for (const transition of transitions) {
    // An alert that already resolved only gets the "recovered" email.
    if (transition.transition === "opened" && transition.resolvedAt) continue;
    let recipients = alertRecipients.get(transition.project.id);
    if (!recipients) {
      recipients = await input.store.listRecipients(
        transition.project.id,
        "alerts",
      );
      alertRecipients.set(transition.project.id, recipients);
    }
    for (const recipient of recipients) {
      if (!canSend()) return summary;
      const unsubscribe = unsubscribeUrl(
        input.baseUrl,
        input.unsubscribeKey,
        recipient,
        "alerts",
      );
      const sent = await deliver(
        {
          kind:
            transition.transition === "opened"
              ? "alert_opened"
              : "alert_resolved",
          projectId: transition.project.id,
          periodKey: transition.alertId,
          recipient,
        },
        () =>
          renderAlertEmail(
            { ...transition, organization: transition.project.organization },
            {
              dashboardUrl: dashboardLink(input.baseUrl, "/overview", {
                organization: transition.project.organization.slug,
                project: transition.project.slug,
              }),
              unsubscribeUrl: unsubscribe,
            },
          ),
        unsubscribe,
      );
      if (sent === true) summary.alerts.sent += 1;
      if (sent === false) summary.alerts.failed += 1;
    }
  }

  // 2. Weekly digests for the last complete week in each project's zone.
  const projects = await input.store.listDigestProjects();
  for (const project of projects) {
    const week = digestWeek(now, project.timeZone);
    if (
      now.getTime() - week.end.getTime() >
      DIGEST_SEND_WINDOW_HOURS * 3_600_000
    )
      continue;
    const recipients = await input.store.listRecipients(project.id, "digest");
    if (!recipients.length) continue;
    // Query the digest only once a claim succeeds, so re-runs after a
    // complete send cost one claim check per recipient.
    let data: Promise<DigestData> | null = null;
    const load = () => {
      data ??= input.store.loadDigest(project, week);
      return data;
    };
    for (const recipient of recipients) {
      if (!canSend()) return summary;
      const unsubscribe = unsubscribeUrl(
        input.baseUrl,
        input.unsubscribeKey,
        recipient,
        "digest",
      );
      const sent = await deliver(
        {
          kind: "digest",
          projectId: project.id,
          periodKey: week.key,
          recipient,
        },
        async () =>
          renderDigestEmail(await load(), {
            dashboardUrl: dashboardLink(input.baseUrl, "/overview", {
              organization: project.organization.slug,
              project: project.slug,
            }),
            unsubscribeUrl: unsubscribe,
          }),
        unsubscribe,
      );
      if (sent === true) summary.digests.sent += 1;
      if (sent === false) summary.digests.failed += 1;
    }
    summary.digests.projects += 1;
  }
  return summary;
}
