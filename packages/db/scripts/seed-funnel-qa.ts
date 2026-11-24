// Seeds a gnd-shaped quote funnel into the local Logly database and checks the
// funnel query against known answers. Local only (port 55438). Run with:
//   bun --env-file=.env.local packages/db/scripts/seed-funnel-qa.ts
import assert from "node:assert/strict";
import { analyticsBatchSchema } from "@ishaqyusuf/logly-core";
import {
  createAnalyticsOrganization,
  createAnalyticsProject,
  createSavedFunnel,
  getDashboardFunnel,
  getFunnelOptions,
  ingestEventBatch,
} from "@logly/db/queries";

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
  name: `Funnel QA ${suffix}`,
  slug: `funnel-qa-${suffix}`,
});
const project = `funnel-qa-gnd-${suffix}`;
await createAnalyticsProject({
  name: "Funnel QA (gnd quotes)",
  slug: project,
  organizationId: organization.id,
  allowedOrigins: ["https://logly.localhost"],
  eventCatalog: [],
});

const MINUTE = 60_000;
const start = Date.now() - 5 * 86_400_000;
type Seed = {
  name: string;
  visitor: number;
  at: number;
  route?: string;
  properties?: Record<string, string>;
};
const seeds: Seed[] = [];
// Ten staff members open a quote; four on the iOS app, six on the web.
for (let v = 0; v < 10; v++)
  seeds.push({
    name: "quote_opened",
    visitor: v,
    at: start + v * 60 * MINUTE,
    route: "/sales-book/edit-quote/:id",
    properties: { quote_type: v % 2 ? "door" : "moulding" },
  });
// Six edit it 10..60 minutes later (median 35 minutes).
for (let v = 0; v < 6; v++)
  seeds.push({
    name: "quote_edited",
    visitor: v,
    at: start + v * 60 * MINUTE + (v + 1) * 10 * MINUTE,
  });
// Three accept 3 hours after opening (150-170 minutes after editing, median
// 160); a fourth only three days later.
for (const [v, channel] of [
  [0, "email"],
  [1, "email"],
  [2, "sms"],
] as const)
  seeds.push({
    name: "quote_accepted",
    visitor: v,
    at: start + v * 60 * MINUTE + 3 * 60 * MINUTE,
    properties: { channel },
  });
seeds.push({
  name: "quote_accepted",
  visitor: 3,
  at: start + 3 * 60 * MINUTE + 3 * 86_400_000,
  properties: { channel: "email" },
});
// Out of order (accepted before opening), and its open is on another route,
// so the route-filtered step 1 never includes this visitor.
seeds.push({ name: "quote_accepted", visitor: 20, at: start });
seeds.push({ name: "quote_opened", visitor: 20, at: start + MINUTE });

const events = seeds.map((seed) => {
  const mobile = seed.visitor < 4;
  return {
    eventId: crypto.randomUUID(),
    project,
    name: seed.name,
    version: 1,
    source: mobile ? "mobile" : "browser",
    ...(mobile
      ? { platform: "ios", appVersion: "2.4.0", appBuild: "240" }
      : {}),
    occurredAt: new Date(seed.at).toISOString(),
    visitorId: `funnel-qa-visitor-${seed.visitor}`,
    route: seed.route ?? "/sales-book/quotes",
    properties: seed.properties ?? {},
  };
});
const batch = analyticsBatchSchema.parse({
  sentAt: new Date().toISOString(),
  sdk: { name: "@ishaqyusuf/logly-core", version: "0.3.0" },
  events,
});
await ingestEventBatch(batch, "local-funnel-qa-only");

const steps = [
  { event: "quote_opened", route: "/sales-book/edit-quote/:id" },
  { event: "quote_edited" },
  { event: "quote_accepted" },
];
const saved = await createSavedFunnel({
  project,
  name: "Quote opened → edited → accepted",
  steps,
  window: "1d",
});
assert.equal(saved.status, "saved");
if (saved.status !== "saved") process.exit(1);

const options = await getFunnelOptions(project);
assert.deepEqual(
  options.funnels.map((funnel) => funnel.name),
  ["Quote opened → edited → accepted"],
);
assert.deepEqual(
  options.events.find((event) => event.name === "quote_accepted")?.properties,
  ["channel"],
);

const run = (extra: Record<string, unknown> = {}) =>
  getDashboardFunnel({
    project,
    organization: organization.slug,
    steps: saved.funnel.steps,
    window: saved.funnel.window,
    start: new Date(start - 86_400_000).toISOString(),
    ...extra,
  });
const day = await run();
assert.deepEqual(
  day.steps.map((step) => step.visitors),
  [10, 6, 3],
);
assert.equal(day.steps[1]?.medianSeconds, 35 * 60);
assert.equal(day.steps[2]?.medianSeconds, 160 * 60);
assert.equal(day.steps[2]?.stepConversion, 50);
assert.deepEqual(
  (await run({ window: "7d" })).steps.map((step) => step.visitors),
  [10, 6, 4],
);
assert.deepEqual(
  (
    await run({
      steps: [
        ...steps.slice(0, 2),
        {
          event: "quote_accepted",
          property: { key: "channel", value: "email" },
        },
      ],
    })
  ).steps.map((step) => step.visitors),
  [10, 6, 2],
);
const platforms = await run({ breakdown: "platform" });
assert.deepEqual(platforms.segments, [
  { value: "web", counts: [6, 2, 0] },
  { value: "ios", counts: [4, 4, 3] },
]);

console.log(
  `Funnel QA checks passed. Saved funnel: /funnels?organization=${organization.slug}&project=${project}&funnel=${saved.funnel.id}`,
);
process.exit(0);
