// Seeds a gnd-shaped project with drifting event names into the local Logly
// database and checks the event catalog against known answers. Local only
// (port 55438). Run with:
//   bun --env-file=.env.local packages/db/scripts/seed-event-catalog-qa.ts
import assert from "node:assert/strict";
import { analyticsBatchSchema } from "@ishaqyusuf/logly-core";
import { getDatabase } from "@logly/db/client";
import {
  createAnalyticsOrganization,
  createAnalyticsProject,
  getEventCatalog,
  getFunnelOptions,
  ingestEventBatch,
  saveEventCatalogMetadata,
} from "@logly/db/queries";
import { sql } from "drizzle-orm";

const databaseUrl = process.env.LOGLY_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Local database configuration is required");
const target = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  target.port !== "55438"
)
  throw new Error("This fixture only runs against local Logly on port 55438");

const suffix = Date.now().toString(36);
const organization = await createAnalyticsOrganization({
  name: `Catalog QA ${suffix}`,
  slug: `catalog-qa-${suffix}`,
});
const project = `catalog-qa-gnd-${suffix}`;
await createAnalyticsProject({
  name: "Catalog QA (gnd names)",
  slug: project,
  organizationId: organization.id,
  allowedOrigins: ["https://logly.localhost"],
  eventCatalog: [],
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();
type Seed = {
  name: string;
  source: "browser" | "mobile" | "server";
  /** Hours ago of each event. */
  hours: number[];
  properties?: Record<string, string>;
};
const spread = (count: number, fromHours: number, toHours: number) =>
  Array.from(
    { length: count },
    (_, i) => fromHours + ((toHours - fromHours) * i) / Math.max(1, count - 1),
  );
const seeds: Seed[] = [
  { name: "site_visit", source: "browser", hours: spread(40, 1, 13 * 24) },
  {
    name: "page_view",
    source: "browser",
    hours: spread(60, 0.5, 13 * 24),
    properties: { path_group: "sales" },
  },
  {
    name: "quote_opened",
    source: "browser",
    hours: spread(18, 2, 6 * 24),
    properties: { quote_type: "door" },
  },
  {
    name: "quote_opened",
    source: "mobile",
    hours: spread(6, 3, 5 * 24),
    properties: { quote_type: "moulding" },
  },
  // Drift: an older build sent quoteopened, a hotfix sent quote_open.
  { name: "quoteopened", source: "mobile", hours: spread(4, 26, 4 * 24) },
  { name: "quote_open", source: "browser", hours: spread(3, 20 * 24, 25 * 24) },
  { name: "app_session", source: "mobile", hours: spread(20, 1, 12 * 24) },
  { name: "screen_view", source: "mobile", hours: spread(30, 1, 12 * 24) },
  { name: "job_opened", source: "mobile", hours: spread(8, 5, 10 * 24) },
  {
    name: "notification_opened",
    source: "mobile",
    hours: spread(5, 4, 3 * 24),
  },
  // Retired: nothing for 40+ days.
  {
    name: "dealer_program_progress_viewed",
    source: "browser",
    hours: spread(5, 40 * 24, 50 * 24),
  },
];

const recent = seeds.flatMap((seed) =>
  seed.hours.filter((hours) => hours < 10 * 24).map((hours) => ({ seed, hours })),
);
const old = seeds.flatMap((seed) =>
  seed.hours
    .filter((hours) => hours >= 10 * 24)
    .map((hours) => ({ seed, hours })),
);
const batchEvents = recent.map(({ seed, hours }, index) => ({
  eventId: crypto.randomUUID(),
  project,
  name: seed.name,
  version: 1,
  source: seed.source,
  ...(seed.source === "mobile"
    ? { platform: "ios", appVersion: "2.4.0", appBuild: "240" }
    : {}),
  occurredAt: new Date(now - hours * HOUR - index).toISOString(),
  visitorId: `catalog-qa-visitor-${index % 9}`,
  route: "/sales-book/quotes",
  properties: seed.properties ?? {},
}));
for (let i = 0; i < batchEvents.length; i += 25)
  await ingestEventBatch(
    analyticsBatchSchema.parse({
      sentAt: new Date().toISOString(),
      sdk: { name: "@ishaqyusuf/logly-core", version: "0.3.0" },
      events: batchEvents.slice(i, i + 25),
    }),
    "local-catalog-qa-only",
  );
// Older events go straight in: ingest only accepts recent timestamps.
const db = getDatabase();
if (!db) throw new Error("Local database is required");
for (const [index, { seed, hours }] of old.entries())
  await db.execute(sql`
    insert into analytics_events
      (project_id, event_id, name, source, occurred_at, visitor_key, route, properties)
    select id, ${crypto.randomUUID()}::uuid, ${seed.name}, ${seed.source},
      ${new Date(now - hours * HOUR - index).toISOString()}::timestamptz,
      ${`catalog-qa-old-${index % 5}`}, '/sales-book/quotes',
      ${JSON.stringify(seed.properties ?? {})}::jsonb
    from analytics_projects where slug = ${project}
  `);

await saveEventCatalogMetadata({
  project,
  name: "quote_opened",
  description: "Staff opened a quote in the sales book or the app",
  notes: "Owner: sales tools",
  deprecated: false,
  hidden: false,
});
await saveEventCatalogMetadata({
  project,
  name: "quote_open",
  description: "Hotfix build name; use quote_opened",
  notes: "",
  deprecated: true,
  hidden: true,
});
await saveEventCatalogMetadata({
  project,
  name: "quoteopened",
  description: "",
  notes: "Old iOS build 2.3",
  deprecated: true,
  hidden: false,
});

const catalog = await getEventCatalog({
  project,
  range: "7d",
  staleDays: 14,
});
const byName = new Map(catalog.events.map((row) => [row.name, row]));
assert.equal(catalog.events.length, 10);
assert.deepEqual(
  catalog.events
    .filter((row) => row.status === "stale")
    .map((row) => row.name)
    .sort(),
  ["dealer_program_progress_viewed", "quote_open"],
);
assert.deepEqual(byName.get("quote_opened")?.sources, ["browser", "mobile"]);
assert.deepEqual(byName.get("quote_opened")?.properties, ["quote_type"]);
assert.deepEqual(
  byName
    .get("quote_opened")
    ?.similar.map((row) => row.name)
    .sort(),
  ["quote_open", "quoteopened"],
);
assert.equal(byName.get("quote_opened")?.count, 24);
assert.equal(byName.get("quote_open")?.hidden, true);
assert.equal(byName.get("screen_view")?.similar.length, 0);

const options = await getFunnelOptions(project);
const picker = options.events.map((event) => event.name);
assert.ok(!picker.includes("quote_open"), "hidden names leave the picker");
assert.ok(picker.includes("quote_opened"));
assert.equal(
  options.events.find((event) => event.name === "quoteopened")?.deprecated,
  true,
);

console.log(
  `Event catalog QA checks passed: /catalog?organization=${organization.slug}&project=${project}`,
);
process.exit(0);
