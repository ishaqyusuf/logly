import { describe, expect, test } from "bun:test";
import {
  type AlertTransition,
  type EmailJobStore,
  type EmailProject,
  type EmailRecipient,
  type EmailSendKind,
  runEmailJob,
} from "./job";
import {
  type DigestData,
  formatChange,
  pickEventMovers,
  renderAlertEmail,
  renderDigestEmail,
} from "./render";
import {
  type EmailMessage,
  type EmailSendResult,
  type EmailTransport,
  emailTransportFromEnv,
  resendTransport,
} from "./sender";
import {
  createUnsubscribeToken,
  unsubscribeKey,
  verifyUnsubscribeToken,
} from "./unsubscribe";
import { digestWeek, formatWeekRange } from "./week";

const KEY = unsubscribeKey("test-secret-test-secret-test-secret");
const SUB = "11111111-1111-4111-8111-111111111111";

describe("digestWeek", () => {
  test("previous Monday to Monday in UTC", () => {
    // Tuesday 2026-11-24
    const week = digestWeek(new Date("2026-11-24T07:00:00Z"));
    expect(week.key).toBe("2026-11-16");
    expect(week.start.toISOString()).toBe("2026-11-16T00:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-11-23T00:00:00.000Z");
    expect(week.previousStart.toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(formatWeekRange(week)).toBe("Nov 16 – Nov 22, 2026");
  });

  test("Monday morning reports the week that just ended", () => {
    const week = digestWeek(new Date("2026-11-23T07:00:00Z"));
    expect(week.key).toBe("2026-11-16");
  });

  test("project time zone, across a DST change", () => {
    // New York DST ended 2026-11-01 (Sunday), inside the week before.
    const week = digestWeek(
      new Date("2026-11-03T12:00:00Z"),
      "America/New_York",
    );
    expect(week.key).toBe("2026-10-26");
    expect(week.start.toISOString()).toBe("2026-10-26T04:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  test("Lagos is ahead of UTC; invalid zones fall back to UTC", () => {
    const lagos = digestWeek(new Date("2026-11-23T00:30:00Z"), "Africa/Lagos");
    // 01:30 Monday in Lagos: the week Nov 16–22 just ended.
    expect(lagos.start.toISOString()).toBe("2026-11-15T23:00:00.000Z");
    expect(digestWeek(new Date(), "Not/AZone").timeZone).toBe("UTC");
  });
});

describe("unsubscribe tokens", () => {
  test("round trip", () => {
    const token = createUnsubscribeToken(KEY, {
      subscriptionId: SUB,
      kind: "digest",
    });
    expect(verifyUnsubscribeToken(KEY, token)).toEqual({
      subscriptionId: SUB,
      kind: "digest",
    });
  });

  test("tampered, wrong-key and malformed tokens fail", () => {
    const token = createUnsubscribeToken(KEY, {
      subscriptionId: SUB,
      kind: "digest",
    });
    expect(
      verifyUnsubscribeToken(KEY, token.replace(".digest.", ".alerts.")),
    ).toBeNull();
    expect(verifyUnsubscribeToken(unsubscribeKey("other"), token)).toBeNull();
    expect(verifyUnsubscribeToken(KEY, "nope")).toBeNull();
    expect(verifyUnsubscribeToken(KEY, null)).toBeNull();
  });
});

describe("emailTransportFromEnv", () => {
  test("disabled outside production, even with keys", () => {
    for (const VERCEL_ENV of [undefined, "preview", "development"]) {
      const transport = emailTransportFromEnv({
        VERCEL_ENV,
        RESEND_API_KEY: "re_x",
        EMAIL_FROM: "Logly <a@b.c>",
      });
      expect(transport.enabled).toBe(false);
    }
  });

  test("disabled in production without keys", () => {
    expect(emailTransportFromEnv({ VERCEL_ENV: "production" }).enabled).toBe(
      false,
    );
  });

  test("Resend in production with keys", () => {
    expect(
      emailTransportFromEnv({
        VERCEL_ENV: "production",
        RESEND_API_KEY: "re_x",
        EMAIL_FROM: "Logly <a@b.c>",
      }).enabled,
    ).toBe(true);
  });
});

describe("resendTransport", () => {
  const message: EmailMessage = {
    to: "op@example.com",
    subject: "s",
    html: "<p>h</p>",
    text: "t",
    idempotencyKey: "k1",
    headers: { "List-Unsubscribe": "<https://x>" },
  };

  test("posts the message with the idempotency key", async () => {
    let request: { url: string; init: RequestInit } | null = null;
    const transport = resendTransport({
      apiKey: "re_x",
      from: "Logly <a@b.c>",
      fetch: (async (url: string, init: RequestInit) => {
        request = { url, init };
        return Response.json({ id: "msg_1" });
      }) as unknown as typeof fetch,
    });
    expect(await transport.send(message)).toEqual({
      status: "sent",
      id: "msg_1",
    });
    const sent = request as unknown as { url: string; init: RequestInit };
    expect(sent.url).toBe("https://api.resend.com/emails");
    const headers = sent.init.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toBe("k1");
    expect(JSON.parse(String(sent.init.body))).toMatchObject({
      from: "Logly <a@b.c>",
      to: ["op@example.com"],
      text: "t",
    });
  });

  test("4xx is not retryable, 5xx and network errors are", async () => {
    const respond = (status: number) =>
      resendTransport({
        apiKey: "k",
        from: "f",
        fetch: (async () =>
          Response.json(
            { message: "bad" },
            { status },
          )) as unknown as typeof fetch,
      });
    expect(await respond(422).send(message)).toMatchObject({
      status: "failed",
      retryable: false,
    });
    expect(await respond(503).send(message)).toMatchObject({
      retryable: true,
    });
    const broken = resendTransport({
      apiKey: "k",
      from: "f",
      fetch: (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
    });
    expect(await broken.send(message)).toMatchObject({
      status: "failed",
      retryable: true,
    });
  });
});

const week = digestWeek(new Date("2026-11-24T07:00:00Z"));
const digest: DigestData = {
  project: { name: "Plot <Keys>", slug: "plot-keys" },
  organization: { name: "Personal", slug: "personal" },
  week,
  visitors: { current: 1200, previous: 1000 },
  events: { current: 5400, previous: 6000 },
  pages: {
    view: "page_view",
    rows: [
      { route: "/listings/[id]", views: 900, previousViews: 800 },
      { route: null, views: 12, previousViews: 0 },
    ],
  },
  movers: [{ name: "signup_completed", count: 40, previousCount: 20 }],
  releases: [
    {
      version: "1.4.0",
      environment: "production",
      deployedAt: "2026-11-18T10:00:00Z",
    },
  ],
  alerts: [
    {
      severity: "stopped",
      openedAt: "2026-11-19T10:00:00Z",
      resolvedAt: "2026-11-19T14:00:00Z",
    },
  ],
};

describe("renderDigestEmail", () => {
  const email = renderDigestEmail(digest, {
    dashboardUrl: "https://logly.example/overview?project=plot-keys",
    unsubscribeUrl: "https://logly.example/api/email/unsubscribe?token=t&x=1",
  });

  test("subject names the project and week", () => {
    expect(email.subject).toBe(
      "Plot <Keys> weekly digest · Nov 16 – Nov 22, 2026",
    );
  });

  test("HTML escapes content and carries every section", () => {
    expect(email.html).toContain("Plot &lt;Keys&gt; weekly digest");
    expect(email.html).not.toContain("Plot <Keys>");
    expect(email.html).toContain("+20%");
    expect(email.html).toContain("−10%");
    expect(email.html).toContain("/listings/[id]");
    expect(email.html).toContain("(no route)");
    expect(email.html).toContain("signup_completed");
    expect(email.html).toContain("1.4.0");
    expect(email.html).toContain("Tracking stopped");
    expect(email.html).toContain("token=t&amp;x=1");
    expect(email.html).not.toMatch(/<script|<style/);
  });

  test("text fallback has the same facts", () => {
    expect(email.text).toContain("Visitors: 1,200 (+20%)");
    expect(email.text).toContain("Events: 5,400 (−10%)");
    expect(email.text).toContain("- signup_completed: 20 -> 40 (+100%)");
    expect(email.text).toContain("Unsubscribe: https://logly.example");
  });

  test("empty sections are short", () => {
    const empty = renderDigestEmail(
      {
        ...digest,
        pages: { view: "screen_view", rows: [] },
        movers: [],
        releases: [],
        alerts: [],
      },
      { dashboardUrl: "https://x", unsubscribeUrl: null },
    );
    expect(empty.html).toContain("Top screens");
    expect(empty.html).not.toContain("Releases");
    expect(empty.text).not.toContain("Unsubscribe:");
  });
});

describe("helpers", () => {
  test("formatChange", () => {
    expect(formatChange(10, 0)).toBe("new");
    expect(formatChange(0, 0)).toBe("–");
    expect(formatChange(5, 10)).toBe("−50%");
    expect(formatChange(10, 10)).toBe("0%");
  });

  test("pickEventMovers ranks by absolute change and skips noise", () => {
    expect(
      pickEventMovers([
        { name: "tiny", count: 3, previousCount: 0 },
        { name: "page_view", count: 900, previousCount: 100 },
        { name: "flat", count: 50, previousCount: 50 },
        { name: "down", count: 10, previousCount: 90 },
        { name: "up", count: 60, previousCount: 20 },
      ]).map((row) => row.name),
    ).toEqual(["down", "up"]);
  });

  test("alert email", () => {
    const email = renderAlertEmail(
      {
        project: { name: "gnd", slug: "gnd" },
        organization: { name: "Personal", slug: "personal" },
        transition: "opened",
        severity: "stopped",
        openedAt: "2026-11-19T10:00:00Z",
        resolvedAt: null,
        observedEvents: 0,
        baselineEvents: 400,
      },
      { dashboardUrl: "https://x", unsubscribeUrl: "https://u" },
    );
    expect(email.subject).toBe("Tracking stopped: gnd");
    expect(email.text).toContain("against a usual 400");
  });
});

// --- Job with a fake store and transport ---------------------------------

type SendRow = {
  id: string;
  status: "sending" | "sent" | "failed" | "rejected";
  attempts: number;
  claimedAt: number;
};

function fakeStore(options: {
  projects?: EmailProject[];
  recipients?: Record<string, EmailRecipient[]>;
  transitions?: AlertTransition[];
}) {
  const sends = new Map<string, SendRow>();
  let nextId = 0;
  const calls = { loadDigest: 0, evaluateAlerts: 0 };
  const store: EmailJobStore = {
    async evaluateAlerts() {
      calls.evaluateAlerts += 1;
    },
    async listDigestProjects() {
      return options.projects ?? [];
    },
    async listRecipients(projectId) {
      return options.recipients?.[projectId] ?? [];
    },
    async loadDigest(project, w) {
      calls.loadDigest += 1;
      return { ...digest, project, week: w };
    },
    async listAlertTransitions() {
      return options.transitions ?? [];
    },
    // Same rules as the SQL claim in @logly/db.
    async claimSend(input: {
      kind: EmailSendKind;
      projectId: string;
      periodKey: string;
      userId: string;
      now: Date;
    }) {
      const key = `${input.kind}|${input.projectId}|${input.periodKey}|${input.userId}`;
      const row = sends.get(key);
      const now = input.now.getTime();
      if (!row) {
        const id = `send_${++nextId}`;
        sends.set(key, { id, status: "sending", attempts: 1, claimedAt: now });
        return id;
      }
      const retry =
        (row.status === "failed" && row.attempts < 3) ||
        (row.status === "sending" && now - row.claimedAt > 15 * 60_000);
      if (!retry) return null;
      row.status = "sending";
      row.attempts += 1;
      row.claimedAt = now;
      return row.id;
    },
    async finishSend(id, result: EmailSendResult) {
      for (const row of sends.values()) {
        if (row.id !== id) continue;
        row.status =
          result.status === "sent"
            ? "sent"
            : result.retryable
              ? "failed"
              : "rejected";
      }
    },
  };
  return { store, sends, calls };
}

function fakeTransport(results: EmailSendResult[] = []) {
  const sent: EmailMessage[] = [];
  const transport: EmailTransport = {
    enabled: true,
    async send(message) {
      sent.push(message);
      return results.shift() ?? { status: "sent", id: `msg_${sent.length}` };
    },
  };
  return { transport, sent };
}

const projectA: EmailProject = {
  id: "p-a",
  slug: "gnd",
  name: "GND",
  timeZone: "UTC",
  organization: { name: "Personal", slug: "personal" },
};
const alice: EmailRecipient = {
  subscriptionId: SUB,
  userId: "u-alice",
  email: "alice@example.com",
};
const bob: EmailRecipient = {
  subscriptionId: "22222222-2222-4222-8222-222222222222",
  userId: "u-bob",
  email: "bob@example.com",
};

const jobInput = (
  store: EmailJobStore,
  transport: EmailTransport,
  now = new Date("2026-11-23T07:00:00Z"),
) => ({
  now,
  store,
  transport,
  baseUrl: "https://logly.example",
  unsubscribeKey: KEY,
  spacingMs: 0,
});

describe("runEmailJob", () => {
  test("sends one digest per recipient, and a re-run sends nothing", async () => {
    const { store, calls } = fakeStore({
      projects: [projectA],
      recipients: { "p-a": [alice, bob] },
    });
    const { transport, sent } = fakeTransport();
    const first = await runEmailJob(jobInput(store, transport));
    expect(first.digests.sent).toBe(2);
    expect(sent.map((m) => m.to)).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
    expect(sent[0]?.subject).toContain("Nov 16 – Nov 22, 2026");
    expect(sent[0]?.headers?.["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click",
    );
    expect(sent[0]?.idempotencyKey).toBe("logly-email-send_1");
    expect(calls.loadDigest).toBe(1);

    // Same week, later run (overlap, retry or Tuesday catch-up).
    const second = await runEmailJob(
      jobInput(store, transport, new Date("2026-11-24T07:00:00Z")),
    );
    expect(second.digests.sent).toBe(0);
    expect(sent).toHaveLength(2);
    expect(calls.loadDigest).toBe(1);
  });

  test("concurrent runs never send twice", async () => {
    const { store } = fakeStore({
      projects: [projectA],
      recipients: { "p-a": [alice, bob] },
    });
    const { transport, sent } = fakeTransport();
    await Promise.all([
      runEmailJob(jobInput(store, transport)),
      runEmailJob(jobInput(store, transport)),
    ]);
    expect(sent).toHaveLength(2);
  });

  test("digests stop after the 48-hour window", async () => {
    const { store } = fakeStore({
      projects: [projectA],
      recipients: { "p-a": [alice] },
    });
    const { transport, sent } = fakeTransport();
    // Wednesday: last week ended 2026-11-23T00:00Z, more than 48h ago.
    await runEmailJob(
      jobInput(store, transport, new Date("2026-11-25T07:00:00Z")),
    );
    expect(sent).toHaveLength(0);
  });

  test("retryable failures retry on the next run, rejections do not", async () => {
    const { store, sends } = fakeStore({
      projects: [projectA],
      recipients: { "p-a": [alice, bob] },
    });
    const { transport, sent } = fakeTransport([
      { status: "failed", error: "503", retryable: true },
      { status: "failed", error: "invalid to", retryable: false },
    ]);
    const first = await runEmailJob(jobInput(store, transport));
    expect(first.digests).toMatchObject({ sent: 0, failed: 2 });
    await runEmailJob(
      jobInput(store, transport, new Date("2026-11-24T07:00:00Z")),
    );
    expect(sent.map((m) => m.to)).toEqual([
      "alice@example.com",
      "bob@example.com",
      "alice@example.com",
    ]);
    expect([...sends.values()].map((row) => row.status).sort()).toEqual([
      "rejected",
      "sent",
    ]);
  });

  test("disabled transport evaluates alerts but claims and sends nothing", async () => {
    const { store, sends, calls } = fakeStore({
      projects: [projectA],
      recipients: { "p-a": [alice] },
    });
    const summary = await runEmailJob(
      jobInput(store, {
        enabled: false,
        reason: "off",
        send: async () => {
          throw new Error("must not send");
        },
      }),
    );
    expect(summary.status).toBe("disabled");
    expect(calls.evaluateAlerts).toBe(1);
    expect(sends.size).toBe(0);
  });

  test("alert transitions email once; an already-resolved alert only sends recovered", async () => {
    const base = {
      project: projectA,
      severity: "stopped",
      openedAt: "2026-11-23T05:00:00Z",
      observedEvents: 0,
      baselineEvents: 300,
    };
    const { store } = fakeStore({
      recipients: { "p-a": [alice] },
      transitions: [
        { ...base, alertId: "a1", transition: "opened", resolvedAt: null },
        {
          ...base,
          alertId: "a2",
          transition: "opened",
          resolvedAt: "2026-11-23T06:00:00Z",
        },
        {
          ...base,
          alertId: "a2",
          transition: "resolved",
          resolvedAt: "2026-11-23T06:00:00Z",
        },
      ],
    });
    const { transport, sent } = fakeTransport();
    const summary = await runEmailJob(jobInput(store, transport));
    expect(summary.alerts.sent).toBe(2);
    expect(sent.map((m) => m.subject)).toEqual([
      "Tracking stopped: GND",
      "Tracking recovered: GND",
    ]);
    await runEmailJob(jobInput(store, transport));
    expect(sent).toHaveLength(2);
  });

  test("stops at the send cap and reports truncation", async () => {
    const { store } = fakeStore({
      projects: [projectA],
      recipients: { "p-a": [alice, bob] },
    });
    const { transport, sent } = fakeTransport();
    const summary = await runEmailJob({
      ...jobInput(store, transport),
      maxSends: 1,
    });
    expect(sent).toHaveLength(1);
    expect(summary.truncated).toBe(true);
  });
});
