import { type DigestWeek, formatWeekRange } from "./week";

/** Everything one project's weekly digest shows. Counts only; no identities. */
export type DigestData = {
  project: { name: string; slug: string };
  organization: { name: string; slug: string };
  week: DigestWeek;
  visitors: { current: number; previous: number };
  events: { current: number; previous: number };
  pages: {
    view: "page_view" | "screen_view";
    rows: Array<{ route: string | null; views: number; previousViews: number }>;
  };
  movers: Array<{ name: string; count: number; previousCount: number }>;
  releases: Array<{
    version: string;
    environment: string;
    deployedAt: string;
  }>;
  alerts: Array<{
    severity: string;
    openedAt: string;
    resolvedAt: string | null;
  }>;
};

export type RenderedEmail = { subject: string; html: string; text: string };

export type AlertEmailData = {
  project: { name: string; slug: string };
  organization: { name: string; slug: string };
  transition: "opened" | "resolved";
  severity: string;
  openedAt: string;
  resolvedAt: string | null;
  observedEvents: number;
  baselineEvents: number;
};

export const DIGEST_TOP_PAGES = 5;
export const DIGEST_MOVERS = 5;
/** A mover needs this many events in one of the two weeks, to skip noise. */
export const DIGEST_MOVER_MIN_EVENTS = 10;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const number = (value: number) => new Intl.NumberFormat("en-US").format(value);

/** "+12%", "−8%", "new" or "–" (no previous data). */
export function formatChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? "new" : "–";
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return "0%";
  return change > 0 ? `+${change}%` : `−${Math.abs(change)}%`;
}

/** Automatic events; visitors and top pages already report them. */
export const DIGEST_MOVER_EXCLUDED = new Set([
  "page_view",
  "screen_view",
  "site_visit",
  "app_session",
]);

/**
 * Event names whose weekly count changed most, by absolute difference.
 * Names below `DIGEST_MOVER_MIN_EVENTS` in both weeks are ignored.
 */
export function pickEventMovers(
  rows: Array<{ name: string; count: number; previousCount: number }>,
  limit = DIGEST_MOVERS,
) {
  return rows
    .filter(
      (row) =>
        !DIGEST_MOVER_EXCLUDED.has(row.name) &&
        row.count !== row.previousCount &&
        Math.max(row.count, row.previousCount) >= DIGEST_MOVER_MIN_EVENTS,
    )
    .sort(
      (a, b) =>
        Math.abs(b.count - b.previousCount) -
          Math.abs(a.count - a.previousCount) || a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

export function dashboardLink(
  baseUrl: string,
  path: string,
  scope: { organization: string; project: string },
) {
  const url = new URL(path, baseUrl);
  url.searchParams.set("organization", scope.organization);
  url.searchParams.set("project", scope.project);
  return url.toString();
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

function shell(input: {
  preheader: string;
  title: string;
  subtitle: string;
  body: string;
  footer: string;
}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f4;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f4;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:8px;">
<tr><td style="padding:24px 24px 8px 24px;font-family:${FONT};">
<p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#347b56;font-weight:600;">Logly</p>
<h1 style="margin:6px 0 0 0;font-size:20px;line-height:28px;color:#111827;font-weight:600;">${escapeHtml(input.title)}</h1>
<p style="margin:4px 0 0 0;font-size:13px;line-height:20px;color:${MUTED};">${escapeHtml(input.subtitle)}</p>
</td></tr>
${input.body}
<tr><td style="padding:16px 24px 24px 24px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};border-top:1px solid ${BORDER};">${input.footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function section(heading: string, content: string) {
  return `<tr><td style="padding:16px 24px 0 24px;font-family:${FONT};">
<h2 style="margin:0 0 8px 0;font-size:13px;line-height:20px;color:#111827;font-weight:600;">${escapeHtml(heading)}</h2>
${content}
</td></tr>`;
}

function rows(cells: Array<[string, string, string?]>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONT};font-size:13px;line-height:20px;">
${cells
  .map(
    ([label, value, note]) => `<tr>
<td style="padding:4px 0;border-bottom:1px solid ${BORDER};color:#111827;word-break:break-all;">${label}</td>
<td align="right" style="padding:4px 0 4px 12px;border-bottom:1px solid ${BORDER};color:#111827;white-space:nowrap;">${value}</td>
<td align="right" width="56" style="padding:4px 0 4px 12px;border-bottom:1px solid ${BORDER};color:${MUTED};white-space:nowrap;">${note ?? ""}</td>
</tr>`,
  )
  .join("\n")}
</table>`;
}

function button(href: string, label: string) {
  return `<tr><td style="padding:20px 24px 20px 24px;font-family:${FONT};">
<a href="${escapeHtml(href)}" style="display:inline-block;background:#1f5c3f;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 16px;border-radius:6px;">${escapeHtml(label)}</a>
</td></tr>`;
}

function footer(input: { scope: string; unsubscribeUrl: string | null }) {
  const unsubscribe = input.unsubscribeUrl
    ? ` <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${MUTED};">Unsubscribe</a>.`
    : "";
  return `You get this because a Logly admin subscribed you to ${escapeHtml(input.scope)}.${unsubscribe}`;
}

const dateTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));

const shortDate = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(new Date(iso));

const routeLabel = (route: string | null) => route ?? "(no route)";

export function renderDigestEmail(
  data: DigestData,
  links: { dashboardUrl: string; unsubscribeUrl: string | null },
): RenderedEmail {
  const range = formatWeekRange(data.week);
  const zone = data.week.timeZone;
  const subject = `${data.project.name} weekly digest · ${range}`;
  const visitorsChange = formatChange(
    data.visitors.current,
    data.visitors.previous,
  );
  const eventsChange = formatChange(data.events.current, data.events.previous);
  const pagesHeading =
    data.pages.view === "screen_view" ? "Top screens" : "Top pages";
  const alertLine = (alert: DigestData["alerts"][number]) =>
    `${alert.severity === "stopped" ? "Tracking stopped" : "Tracking dropped"}, opened ${dateTime(alert.openedAt, zone)}${alert.resolvedAt ? `, resolved ${dateTime(alert.resolvedAt, zone)}` : ", still open"}`;

  const body = [
    section(
      "This week",
      rows([
        ["Visitors", number(data.visitors.current), visitorsChange],
        ["Events", number(data.events.current), eventsChange],
      ]),
    ),
    section(
      pagesHeading,
      data.pages.rows.length
        ? rows(
            data.pages.rows.map((row) => [
              escapeHtml(routeLabel(row.route)),
              number(row.views),
              formatChange(row.views, row.previousViews),
            ]),
          )
        : `<p style="margin:0;font-size:13px;color:${MUTED};">No ${data.pages.view} events this week.</p>`,
    ),
    section(
      "Biggest movers",
      data.movers.length
        ? rows(
            data.movers.map((row) => [
              escapeHtml(row.name),
              `${number(row.previousCount)} → ${number(row.count)}`,
              formatChange(row.count, row.previousCount),
            ]),
          )
        : `<p style="margin:0;font-size:13px;color:${MUTED};">No event changed by much.</p>`,
    ),
    data.releases.length
      ? section(
          "Releases",
          rows(
            data.releases.map((release) => [
              escapeHtml(release.version),
              escapeHtml(release.environment),
              escapeHtml(shortDate(release.deployedAt, zone)),
            ]),
          ),
        )
      : "",
    data.alerts.length
      ? section(
          "Tracking alerts",
          data.alerts
            .map(
              (alert) =>
                `<p style="margin:0 0 4px 0;font-size:13px;line-height:20px;color:#b42318;">${escapeHtml(alertLine(alert))}</p>`,
            )
            .join("\n"),
        )
      : "",
    button(links.dashboardUrl, "Open the dashboard"),
  ].join("\n");

  const html = shell({
    preheader: `${number(data.visitors.current)} visitors (${visitorsChange}), ${number(data.events.current)} events (${eventsChange})`,
    title: `${data.project.name} weekly digest`,
    subtitle: `${range} · ${data.organization.name}${zone === "UTC" ? " · UTC" : ` · ${zone}`}`,
    body,
    footer: footer({
      scope: `the weekly digest for ${data.project.name}`,
      unsubscribeUrl: links.unsubscribeUrl,
    }),
  });

  const text = [
    `${data.project.name} weekly digest`,
    `${range} (${zone}) · ${data.organization.name}`,
    "",
    `Visitors: ${number(data.visitors.current)} (${visitorsChange})`,
    `Events: ${number(data.events.current)} (${eventsChange})`,
    "",
    `${pagesHeading}:`,
    ...(data.pages.rows.length
      ? data.pages.rows.map(
          (row) =>
            `- ${routeLabel(row.route)}: ${number(row.views)} (${formatChange(row.views, row.previousViews)})`,
        )
      : [`- No ${data.pages.view} events this week.`]),
    "",
    "Biggest movers:",
    ...(data.movers.length
      ? data.movers.map(
          (row) =>
            `- ${row.name}: ${number(row.previousCount)} -> ${number(row.count)} (${formatChange(row.count, row.previousCount)})`,
        )
      : ["- No event changed by much."]),
    ...(data.releases.length
      ? [
          "",
          "Releases:",
          ...data.releases.map(
            (release) =>
              `- ${release.version} (${release.environment}), ${shortDate(release.deployedAt, zone)}`,
          ),
        ]
      : []),
    ...(data.alerts.length
      ? ["", "Tracking alerts:", ...data.alerts.map((a) => `- ${alertLine(a)}`)]
      : []),
    "",
    `Open the dashboard: ${links.dashboardUrl}`,
    "",
    links.unsubscribeUrl
      ? `Unsubscribe: ${links.unsubscribeUrl}`
      : "You get this because a Logly admin subscribed you.",
  ].join("\n");

  return { subject, html, text };
}

export function renderAlertEmail(
  data: AlertEmailData,
  links: { dashboardUrl: string; unsubscribeUrl: string | null },
): RenderedEmail {
  const opened = data.transition === "opened";
  const what = data.severity === "stopped" ? "stopped" : "dropped";
  const subject = opened
    ? `Tracking ${what}: ${data.project.name}`
    : `Tracking recovered: ${data.project.name}`;
  const summary = opened
    ? `${data.project.name} received ${number(data.observedEvents)} events in the last 3 hours, against a usual ${number(data.baselineEvents)}.`
    : `Events for ${data.project.name} are back to normal. The alert opened ${dateTime(data.openedAt, "UTC")} and resolved ${dateTime(data.resolvedAt ?? data.openedAt, "UTC")}.`;
  const advice = opened
    ? "Check the latest release, the analytics proxy route and the project key."
    : "No action is needed.";
  const html = shell({
    preheader: summary,
    title: subject,
    subtitle: data.organization.name,
    body: `${section(
      opened ? "What happened" : "Resolved",
      `<p style="margin:0;font-size:13px;line-height:20px;color:#111827;">${escapeHtml(summary)}</p>
<p style="margin:8px 0 0 0;font-size:13px;line-height:20px;color:${MUTED};">${escapeHtml(advice)}</p>`,
    )}
${button(links.dashboardUrl, "Open the dashboard")}`,
    footer: footer({
      scope: `tracking alerts for ${data.project.name}`,
      unsubscribeUrl: links.unsubscribeUrl,
    }),
  });
  const text = [
    subject,
    "",
    summary,
    advice,
    "",
    `Open the dashboard: ${links.dashboardUrl}`,
    "",
    links.unsubscribeUrl
      ? `Unsubscribe: ${links.unsubscribeUrl}`
      : "You get this because a Logly admin subscribed you.",
  ].join("\n");
  return { subject, html, text };
}
