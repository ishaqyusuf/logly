// SQL fixture tests for the email channel (feature 8). Runs only against a
// disposable local PostgreSQL database (host local, name ending in "_test")
// named by LOGLY_SQL_TEST_DATABASE_URL; applies every migration into a fresh
// schema.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";
import {
  claimEmailSend,
  finishEmailSend,
  getWeeklyDigestMetrics,
  listAlertTransitions,
  listDigestProjects,
  listEmailRecipients,
  listEmailSubscriptions,
  setEmailSubscription,
  unsubscribeEmail,
} from "./email";

const url = process.env.LOGLY_SQL_TEST_DATABASE_URL;
const target = url ? new URL(url) : null;
const runnable = Boolean(
  target &&
    ["127.0.0.1", "localhost"].includes(target.hostname) &&
    target.pathname.endsWith("_test"),
);
const schemaName = `email_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;
const ids: Record<string, string> = {};

describe.skipIf(!runnable)("email SQL", () => {
  beforeAll(async () => {
    client = postgres(url ?? "", {
      max: 1,
      prepare: false,
      onnotice: () => {},
      connection: { search_path: schemaName },
    });
    db = drizzle(client, { schema });
    await client.unsafe(`create schema "${schemaName}"`);
    const dir = join(import.meta.dir, "../../drizzle");
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const text = readFileSync(join(dir, file), "utf8").replaceAll(
        '"public".',
        `"${schemaName}".`,
      );
      for (const statement of text.split("--> statement-breakpoint"))
        if (statement.trim()) await client.unsafe(statement);
    }
    const [org] =
      await client`insert into analytics_organizations (slug, name) values ('mail-org', 'Mail Org') returning id`;
    const [other] =
      await client`insert into analytics_organizations (slug, name) values ('other-org', 'Other') returning id`;
    ids.org = org?.id;
    ids.otherOrg = other?.id;
    for (const [key, slug, orgId] of [
      ["web", "mail-web", org?.id],
      ["app", "mail-app", org?.id],
      ["far", "far-web", other?.id],
    ] as const) {
      const [row] =
        await client`insert into analytics_projects (organization_id, slug, name) values (${orgId}, ${slug}, ${slug}) returning id`;
      ids[key] = row?.id;
    }
    for (const [id, email, banned] of [
      ["u-alice", "alice@example.com", false],
      ["u-bob", "bob@example.com", false],
      ["u-banned", "x@example.com", true],
    ] as const) {
      await client`insert into "user" (id, name, email, banned) values (${id}, ${id}, ${email}, ${banned})`;
    }
  });

  afterAll(async () => {
    if (client) {
      await client.unsafe(`drop schema if exists "${schemaName}" cascade`);
      await client.end();
    }
  });

  test("subscriptions: scopes, recipients and unsubscribe", async () => {
    const web = ids.web as string;
    const org = ids.org as string;
    // Alice: organization digest + project alerts. Bob: project digest.
    await setEmailSubscription(
      {
        userId: "u-alice",
        scope: { organizationId: org },
        weeklyDigest: true,
        trackingAlerts: false,
      },
      db,
    );
    await setEmailSubscription(
      {
        userId: "u-alice",
        scope: { projectId: web },
        weeklyDigest: true,
        trackingAlerts: true,
      },
      db,
    );
    await setEmailSubscription(
      {
        userId: "u-bob",
        scope: { projectId: web },
        weeklyDigest: true,
        trackingAlerts: false,
      },
      db,
    );
    expect(
      (
        await setEmailSubscription(
          {
            userId: "u-banned",
            scope: { projectId: web },
            weeklyDigest: true,
            trackingAlerts: true,
          },
          db,
        )
      ).status,
    ).toBe("user_not_found");

    const operators = await listEmailSubscriptions(
      { id: web, organizationId: org },
      db,
    );
    expect(operators.map((row) => row.userId)).toEqual(["u-alice", "u-bob"]);
    expect(operators[0]).toMatchObject({
      project: { digest: true, alerts: true },
      organization: { digest: true, alerts: false },
    });

    const digest = await listEmailRecipients(web, "digest", db);
    expect(digest.map((row) => row.email)).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
    // Alice's digest comes through the organization row.
    const aliceOrgRow = digest[0]?.subscriptionId as string;
    expect(
      (await listEmailRecipients(ids.app as string, "digest", db)).map(
        (row) => row.userId,
      ),
    ).toEqual(["u-alice"]);
    expect(
      (await listEmailRecipients(web, "alerts", db)).map((row) => row.userId),
    ).toEqual(["u-alice"]);
    expect(
      (await listDigestProjects(db)).map((project) => project.slug),
    ).toEqual(["mail-app", "mail-web"]);

    // Unsubscribing from the organization row stops Alice's digest for every
    // project in it, but keeps her project alerts.
    expect(
      await unsubscribeEmail(
        { subscriptionId: aliceOrgRow, kind: "digest" },
        db,
      ),
    ).toEqual({ scope: "organization", name: "Mail Org" });
    expect(
      (await listEmailRecipients(web, "digest", db)).map((row) => row.userId),
    ).toEqual(["u-bob"]);
    expect(
      (await listEmailRecipients(web, "alerts", db)).map((row) => row.userId),
    ).toEqual(["u-alice"]);
    const remaining = await client<
      { count: number }[]
    >`select count(*)::int as count from analytics_email_subscriptions where user_id = 'u-alice'`;
    expect(remaining[0]?.count).toBe(1);

    // Both kinds off removes the row.
    await setEmailSubscription(
      {
        userId: "u-bob",
        scope: { projectId: web },
        weeklyDigest: false,
        trackingAlerts: false,
      },
      db,
    );
    expect(await listEmailRecipients(web, "digest", db)).toEqual([]);
  });

  test("send claims are exclusive, retry failures and cap attempts", async () => {
    const claim = (now: string, userId = "u-alice") =>
      claimEmailSend(
        {
          kind: "digest",
          projectId: ids.web as string,
          periodKey: "2026-11-16",
          userId,
          now: new Date(now),
        },
        db,
      );
    const first = await claim("2026-11-23T07:00:00Z");
    expect(first).toBeTruthy();
    // In flight: a second run cannot claim it.
    expect(await claim("2026-11-23T07:01:00Z")).toBeNull();
    // Concurrent claims for a new recipient: exactly one wins.
    const racers = await Promise.all([
      claim("2026-11-23T07:00:00Z", "u-bob"),
      claim("2026-11-23T07:00:00Z", "u-bob"),
    ]);
    expect(racers.filter(Boolean)).toHaveLength(1);

    const failed = { status: "failed" as const, error: "503", retryable: true };
    await finishEmailSend(first as string, failed, new Date(), db);
    expect(await claim("2026-11-23T07:02:00Z")).toBe(first);
    await finishEmailSend(first as string, failed, new Date(), db);
    expect(await claim("2026-11-23T07:03:00Z")).toBe(first);
    await finishEmailSend(first as string, failed, new Date(), db);
    // Third failure hits the attempt cap.
    expect(await claim("2026-11-23T07:04:00Z")).toBeNull();

    // A crashed claim (left in `sending`) is retried after 15 minutes.
    const bob = racers.find(Boolean) as string;
    expect(await claim("2026-11-23T07:10:00Z", "u-bob")).toBeNull();
    expect(await claim("2026-11-23T07:16:00Z", "u-bob")).toBe(bob);
    await finishEmailSend(
      bob,
      { status: "sent", id: "msg_1" },
      new Date("2026-11-23T07:16:01Z"),
      db,
    );
    expect(await claim("2026-11-24T07:00:00Z", "u-bob")).toBeNull();
    const [row] = await client<
      { status: string; attempts: number; provider_message_id: string }[]
    >`select status, attempts, provider_message_id from analytics_email_sends where id = ${bob}`;
    expect(row).toEqual({
      status: "sent",
      attempts: 2,
      provider_message_id: "msg_1",
    });
  });

  test("weekly digest metrics and alert transitions", async () => {
    const project = ids.app as string;
    const event = (
      name: string,
      at: string,
      visitor: string | null,
      route: string | null = null,
    ) =>
      client`insert into analytics_events (project_id, event_id, name, source, visitor_key, route, occurred_at, received_at, properties)
        values (${project}, ${crypto.randomUUID()}, ${name}, 'browser', ${visitor}, ${route}, ${at}, ${at}, '{}'::jsonb)`;
    // Previous week (Nov 9–15): 2 visitors.
    for (let i = 0; i < 20; i++)
      await event("search", "2026-11-10T10:00:00Z", "v1");
    await event("page_view", "2026-11-10T10:00:00Z", "v2", "/home");
    // Reported week (Nov 16–22): 3 visitors.
    for (const visitor of ["v1", "v2", "v3"])
      await event("page_view", "2026-11-17T10:00:00Z", visitor, "/home");
    await event("page_view", "2026-11-18T10:00:00Z", "v3", "/pricing");
    for (let i = 0; i < 12; i++)
      await event("signup", "2026-11-19T10:00:00Z", "v3");
    // Outside both weeks.
    await event("page_view", "2026-11-23T00:00:00Z", "v9", "/late");
    await client`insert into analytics_releases (project_id, environment, version, deployed_at, source)
      values (${project}, 'production', '2.0.0', '2026-11-18T09:00:00Z', 'api'),
             (${project}, 'production', '1.9.0', '2026-11-12T09:00:00Z', 'api')`;
    await client`insert into analytics_tracking_alerts (project_id, severity, opened_at, resolved_at, observed_events, baseline_events)
      values (${project}, 'drop', '2026-11-20T09:00:00Z', '2026-11-20T15:00:00Z', 3, 200),
             (${project}, 'stopped', '2026-11-01T09:00:00Z', '2026-11-02T09:00:00Z', 0, 200)`;

    const metrics = await getWeeklyDigestMetrics(
      { id: project, slug: "mail-app" },
      {
        start: new Date("2026-11-16T00:00:00Z"),
        end: new Date("2026-11-23T00:00:00Z"),
        previousStart: new Date("2026-11-09T00:00:00Z"),
      },
      db,
    );
    expect(metrics.visitors).toEqual({ current: 3, previous: 2 });
    expect(metrics.events).toEqual({ current: 16, previous: 21 });
    expect(metrics.pages).toEqual({
      view: "page_view",
      rows: [
        { route: "/home", views: 3, previousViews: 1 },
        { route: "/pricing", views: 1, previousViews: 0 },
      ],
    });
    expect(metrics.eventCounts.slice(0, 2)).toEqual([
      { name: "search", count: 0, previousCount: 20 },
      { name: "signup", count: 12, previousCount: 0 },
    ]);
    expect(metrics.releases.map((r) => r.version)).toEqual(["2.0.0"]);
    expect(metrics.alerts).toEqual([
      {
        severity: "drop",
        openedAt: "2026-11-20T09:00:00.000Z",
        resolvedAt: "2026-11-20T15:00:00.000Z",
      },
    ]);

    const transitions = await listAlertTransitions(
      new Date("2026-11-19T00:00:00Z"),
      db,
    );
    expect(
      transitions.map((t) => [t.transition, t.project.slug, t.severity]),
    ).toEqual([
      ["opened", "mail-app", "drop"],
      ["resolved", "mail-app", "drop"],
    ]);
  });
});
