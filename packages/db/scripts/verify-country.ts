import assert from "node:assert/strict";
import { analyticsBatchSchema } from "@ishaqyusuf/logly-core";
import {
  createAnalyticsOrganization,
  createAnalyticsProject,
  getDashboardData,
  getDashboardEventSummary,
  getDashboardFunnel,
  ingestEventBatch,
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
  name: `Country Map QA ${suffix}`,
  slug: `country-map-qa-${suffix}`,
});
const project = `country-map-qa-${suffix}`;
await createAnalyticsProject({
  name: "Country Map QA",
  slug: project,
  organizationId: organization.id,
  allowedOrigins: ["https://logly.localhost"],
  eventCatalog: [],
});
const now = new Date();
const events = Array.from({ length: 251 }, (_, i) => ({
  eventId: crypto.randomUUID(),
  project,
  name: "site_visit",
  version: 1,
  source: "browser",
  occurredAt: now.toISOString(),
  visitorId: `qa-visitor-${i}`,
  visitKind: "new",
  route: "/",
  properties: {},
  ...(i < 200
    ? { referrerHost: "search.example", campaign: { source: "search" } }
    : {}),
}));
for (let offset = 0; offset < events.length; offset += 25) {
  const batch = analyticsBatchSchema.parse({
    sentAt: now.toISOString(),
    sdk: { name: "@ishaqyusuf/logly-core", version: "0.2.0" },
    events: events.slice(offset, offset + 25),
  });
  await ingestEventBatch(
    batch,
    "local-country-map-qa-only",
    offset < 100 ? "NG" : offset < 200 ? "US" : offset < 250 ? "GB" : null,
  );
}
// Retry from another network must not alter the first accepted country.
await ingestEventBatch(
  analyticsBatchSchema.parse({
    sentAt: now.toISOString(),
    sdk: { name: "@ishaqyusuf/logly-core", version: "0.2.0" },
    events: events.slice(0, 25),
  }),
  "local-country-map-qa-only",
  "FR",
);
const query = {
  project,
  organization: organization.slug,
  start: new Date(now.getTime() - 1000).toISOString(),
  end: new Date(now.getTime() + 1000).toISOString(),
  pageSize: 10,
};
const summary = await getDashboardEventSummary(query);
assert.deepEqual(summary.geography, {
  totalVisits: 251,
  unknownVisits: 1,
  countries: [
    { code: "NG", name: "Nigeria", count: 100 },
    { code: "US", name: "United States", count: 100 },
    { code: "GB", name: "United Kingdom", count: 50 },
  ],
});
assert.equal(
  (await getDashboardEventSummary({ ...query, organization: "wrong" }))
    .geography.totalVisits,
  0,
);
assert.equal(
  (await getDashboardEventSummary({ ...query, names: ["page_view"] })).geography
    .totalVisits,
  0,
);
assert.equal(
  (await getDashboardEventSummary({ ...query, sources: ["server"] })).geography
    .totalVisits,
  0,
);
assert.deepEqual(summary.acquisition, {
  totalVisits: 251,
  referrers: [
    { label: "search.example", count: 200 },
    { label: "Direct / unknown", count: 51 },
  ],
  campaignSources: [
    { label: "search", count: 200 },
    { label: "Unattributed", count: 51 },
  ],
});
assert.equal(
  (await getDashboardEventSummary({ ...query, organization: "non-matching" }))
    .acquisition.totalVisits,
  0,
);
assert.equal(
  (await getDashboardEventSummary({ ...query, names: ["page_view"] }))
    .acquisition.totalVisits,
  0,
);
assert.equal(
  (await getDashboardEventSummary({ ...query, sources: ["server"] }))
    .acquisition.totalVisits,
  0,
);
assert.equal(
  (
    await getDashboardEventSummary({
      ...query,
      end: new Date(now.getTime() - 1).toISOString(),
    })
  ).acquisition.totalVisits,
  0,
);
const health = (await getDashboardData(project, organization.slug)).overview
  .collectionHealth;
assert.equal(health.recentEvents, 251);
assert.ok(health.lastReceivedAt);
assert.ok(health.averageLagSeconds !== null && health.averageLagSeconds >= 0);
assert.equal(health.clockSkewEvents, 0);
const emptyHealth = (
  await getDashboardData("missing-project", organization.slug)
).overview.collectionHealth;
assert.deepEqual(emptyHealth, {
  recentEvents: 0,
  lastReceivedAt: null,
  averageLagSeconds: null,
  clockSkewEvents: 0,
});
for (const [name, count, delay] of [
  ["checkout", 200, 10],
  ["paid", 100, 20],
] as const) {
  for (let offset = 0; offset < count; offset += 25) {
    await ingestEventBatch(
      analyticsBatchSchema.parse({
        sentAt: new Date().toISOString(),
        sdk: { name: "@ishaqyusuf/logly-core", version: "0.2.0" },
        events: Array.from(
          { length: Math.min(25, count - offset) },
          (_, index) => ({
            eventId: crypto.randomUUID(),
            project,
            name,
            version: 1,
            source: "browser",
            occurredAt: new Date(now.getTime() + delay).toISOString(),
            visitorId: `qa-visitor-${offset + index}`,
            properties: {},
          }),
        ),
      }),
      "local-country-map-qa-only",
    );
  }
}
const funnelQuery = { ...query, steps: ["site_visit", "checkout", "paid"] };
assert.deepEqual(
  (await getDashboardFunnel(funnelQuery)).steps.map((step) => step.visitors),
  [251, 200, 100],
);
assert.deepEqual(
  (
    await getDashboardFunnel({
      ...funnelQuery,
      organization: "not-this-organization",
    })
  ).steps.map((step) => step.visitors),
  [0, 0, 0],
);
assert.deepEqual(
  (
    await getDashboardFunnel({ ...funnelQuery, steps: ["paid", "checkout"] })
  ).steps.map((step) => step.visitors),
  [100, 0],
);
console.log(
  `Country SQL checks passed. Retained local QA fixture: /insights?organization=${organization.slug}&project=${project}`,
);
process.exit(0);
