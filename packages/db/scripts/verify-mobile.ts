import assert from "node:assert/strict";
import {
  analyticsBatchSchema,
  LOGLY_CORE_VERSION,
} from "@ishaqyusuf/logly-core";
import {
  createAnalyticsOrganization,
  createAnalyticsProject,
  getDashboardEventSummary,
  ingestEventBatch,
  listDashboardEventPage,
} from "@logly/db/queries";

const databaseUrl = process.env.LOGLY_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Local database configuration is required");
const target = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  target.port !== "55438"
) {
  throw new Error("This fixture only runs against local Logly on port 55438");
}

const suffix = Date.now().toString(36);
const organization = await createAnalyticsOrganization({
  name: `Mobile Platform QA ${suffix}`,
  slug: `mobile-platform-qa-${suffix}`,
});
const project = `mobile-platform-qa-${suffix}`;
await createAnalyticsProject({
  name: "Mobile Platform QA",
  slug: project,
  organizationId: organization.id,
  allowedOrigins: ["https://api.gnd.test"],
  eventCatalog: [],
});
const now = new Date();
const nativeEvent = (
  platform: "ios" | "android",
  name: "app_session" | "screen_view" | "job_opened",
  visitorId: string,
) => ({
  eventId: crypto.randomUUID(),
  project,
  name,
  version: 1,
  source: "mobile" as const,
  platform,
  appVersion: platform === "android" ? "1.4.0" : "1.3.0",
  appBuild: platform === "android" ? "104" : "99",
  occurredAt: now.toISOString(),
  visitorId,
  route: "/jobs",
  properties: {},
});
const ingest = (events: ReturnType<typeof nativeEvent>[], country: string) =>
  ingestEventBatch(
    analyticsBatchSchema.parse({
      sentAt: now.toISOString(),
      sdk: { name: "@ishaqyusuf/logly-core", version: LOGLY_CORE_VERSION },
      events,
    }),
    "local-mobile-platform-qa-only",
    country,
  );

await ingest(
  [
    nativeEvent("android", "app_session", "android-install-a"),
    nativeEvent("android", "screen_view", "android-install-a"),
    nativeEvent("android", "app_session", "android-install-b"),
    nativeEvent("android", "job_opened", "android-install-b"),
  ],
  "US",
);
await ingest(
  [
    nativeEvent("ios", "app_session", "ios-install-a"),
    nativeEvent("ios", "screen_view", "ios-install-a"),
  ],
  "NG",
);

const query = {
  project,
  organization: organization.slug,
  start: new Date(now.getTime() - 1_000).toISOString(),
  end: new Date(now.getTime() + 1_000).toISOString(),
};
const summary = await getDashboardEventSummary(query);
assert.deepEqual(summary.mobile, {
  totalSessions: 3,
  totalEvents: 6,
  uniqueInstallations: 3,
  platforms: [
    { platform: "android", sessions: 2, events: 4, installations: 2 },
    { platform: "ios", sessions: 1, events: 2, installations: 1 },
  ],
  versions: [
    {
      platform: "android",
      version: "1.4.0",
      build: "104",
      sessions: 2,
      events: 4,
    },
    { platform: "ios", version: "1.3.0", build: "99", sessions: 1, events: 2 },
  ],
});
assert.deepEqual(summary.geography, {
  totalVisits: 3,
  unknownVisits: 0,
  countries: [
    { code: "US", name: "United States", count: 2 },
    { code: "NG", name: "Nigeria", count: 1 },
  ],
});
assert.equal(summary.acquisition.totalVisits, 0);
assert.equal(
  (await getDashboardEventSummary({ ...query, platforms: ["ios"] }))
    .totalEvents,
  2,
);
assert.equal(
  (await listDashboardEventPage({ ...query, platforms: ["android"] })).data
    .length,
  4,
);

console.log(
  `Mobile SQL checks passed. Retained local QA fixture: /insights?organization=${organization.slug}&project=${project}`,
);
