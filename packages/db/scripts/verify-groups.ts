import assert from "node:assert/strict";
import { analyticsBatchSchema } from "@ishaqyusuf/logly-core";
import {
  createAnalyticsOrganization,
  createAnalyticsProject,
  getDashboardEventById,
  getDashboardEventSummary,
  ingestEventBatch,
  listDashboardEventPage,
  listDashboardGroups,
} from "@logly/db/queries";

const target = new URL(
  process.env.LOGLY_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "http://invalid",
);
if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  target.port !== "55438"
)
  throw new Error("Local Logly database required");
const suffix = Date.now().toString(36);
const organization = await createAnalyticsOrganization({
  name: `Group QA ${suffix}`,
  slug: `group-qa-${suffix}`,
});
const project = `group-qa-${suffix}`;
const otherProject = `other-group-qa-${suffix}`;
for (const slug of [project, otherProject])
  await createAnalyticsProject({
    name: slug,
    slug,
    organizationId: organization.id,
    allowedOrigins: ["https://groups.test"],
    eventCatalog: [],
  });
const time = new Date().toISOString();
function event(index: number, slug = project) {
  return {
    eventId: crypto.randomUUID(),
    project: slug,
    name: "order_created",
    version: 1,
    source: "browser",
    occurredAt: time,
    actorId: `opaque-user-${index % 2}`,
    visitorId: `installation-${index % 2}`,
    groups: {
      business: {
        key: index < 120 ? "opaque-a" : "opaque-b",
        properties: {
          name: index < 120 ? "Amina Market" : "Green Cooperative",
          plan: "pro",
        },
      },
    },
    properties: { channel: index % 2 ? "web" : "pos", item_count: 3 },
  };
}
const events = Array.from({ length: 150 }, (_, i) => event(i));
const firstEvent = events[0];
assert.ok(firstEvent);
function batch(rows: unknown[]) {
  return analyticsBatchSchema.parse({
    sentAt: time,
    sdk: { name: "@ishaqyusuf/logly-core", version: "0.3.0" },
    events: rows,
  });
}
for (let index = 0; index < events.length; index += 25)
  await ingestEventBatch(
    batch(events.slice(index, index + 25)),
    "local-group-secret",
  );
assert.equal(
  (await ingestEventBatch(batch([events[0]]), "local-group-secret")).duplicate,
  1,
);
await ingestEventBatch(batch([event(0, otherProject)]), "local-group-secret");
const groups = await listDashboardGroups({ project });
assert.equal(groups.data.length, 2);
const a = groups.data.find((group) => group.name === "Amina Market");
assert.ok(a);
assert.equal(
  (await listDashboardGroups({ project, q: "Amina" })).data.length,
  1,
);
assert.notEqual(
  a.key,
  (await listDashboardGroups({ project: otherProject })).data[0]?.key,
);
const query = {
  project,
  groupType: "business",
  groupKey: a.key,
  start: new Date(Date.now() - 60_000).toISOString(),
};
assert.equal((await getDashboardEventSummary(query)).totalEvents, 120);
assert.equal(
  (
    await getDashboardEventSummary({
      ...query,
      propertyKey: "channel",
      propertyValue: '"pos"',
    })
  ).totalEvents,
  60,
);
assert.equal(
  (
    await getDashboardEventSummary({
      ...query,
      propertyKey: "item_count",
      propertyValue: '"3"',
    })
  ).totalEvents,
  0,
);
let count = 0;
let cursor: string | undefined;
do {
  const page = await listDashboardEventPage({ ...query, pageSize: 50, cursor });
  count += page.data.length;
  assert.ok(page.data.every((row) => row.groups?.business?.key === a.key));
  cursor = page.meta.cursor ?? undefined;
} while (cursor);
assert.equal(count, 120);
assert.equal(
  (await getDashboardEventSummary({ ...query, project: otherProject }))
    .totalEvents,
  0,
);
const first = await getDashboardEventById(firstEvent.eventId, project);
assert.ok(first?.actorId);
assert.equal(
  (await getDashboardEventSummary({ ...query, actor: first.actorId }))
    .totalEvents,
  60,
);
assert.equal(
  await getDashboardEventById(firstEvent.eventId, otherProject),
  null,
);
assert.equal(JSON.stringify(first).includes("opaque-a"), false);
console.log(
  JSON.stringify({
    passed: true,
    events: count,
    fixture: `/events?organization=${organization.slug}&project=${project}`,
  }),
);
process.exit(0);
