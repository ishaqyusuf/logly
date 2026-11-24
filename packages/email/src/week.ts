/**
 * Digest week: the most recent complete Monday–Sunday in the project's time
 * zone (`analytics_projects.timezone`, default UTC). Boundaries are local
 * midnights converted to UTC instants, so DST weeks are 167 or 169 hours.
 */

export type DigestWeek = {
  /** Local Monday of the reported week, `YYYY-MM-DD`; the idempotency key. */
  key: string;
  timeZone: string;
  start: Date;
  end: Date;
  /** Start of the week before, for week-over-week change. */
  previousStart: Date;
};

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function localParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(instant);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

/** Milliseconds the zone is ahead of UTC at `instant`. */
function zoneOffset(instant: Date, timeZone: string) {
  const local = localParts(instant, timeZone);
  const asUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** UTC instant of local midnight on the given UTC-encoded calendar day. */
function localMidnight(calendarDay: number, timeZone: string) {
  let guess = calendarDay - zoneOffset(new Date(calendarDay), timeZone);
  // One correction handles a DST change between the guess and the answer.
  guess = calendarDay - zoneOffset(new Date(guess), timeZone);
  return new Date(guess);
}

export function digestWeek(now: Date, timeZone = "UTC"): DigestWeek {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const local = localParts(now, zone);
  const today = Date.UTC(local.year, local.month - 1, local.day);
  const thisMonday = today - Math.max(local.weekday, 0) * DAY_MS;
  const weekMonday = thisMonday - 7 * DAY_MS;
  return {
    key: new Date(weekMonday).toISOString().slice(0, 10),
    timeZone: zone,
    start: localMidnight(weekMonday, zone),
    end: localMidnight(thisMonday, zone),
    previousStart: localMidnight(weekMonday - 7 * DAY_MS, zone),
  };
}

/** "Nov 16 – Nov 22, 2026" for the reported week (end is exclusive). */
export function formatWeekRange(week: DigestWeek) {
  const day = (instant: Date, withYear: boolean) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: week.timeZone,
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    }).format(instant);
  const lastDay = new Date(week.end.getTime() - 1);
  return `${day(week.start, false)} – ${day(lastDay, true)}`;
}
