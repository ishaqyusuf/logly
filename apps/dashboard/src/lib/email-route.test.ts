import { describe, expect, test } from "bun:test";
import {
  createUnsubscribeToken,
  type EmailSubscriptionKind,
  unsubscribeKey,
  verifyUnsubscribeToken,
} from "@logly/email";
import {
  handleEmailCron,
  handleSetSubscription,
  handleTestDigest,
  handleUnsubscribe,
  parseSubscriptionInput,
} from "./email-route";
import { emailBaseUrl } from "./email-service";

const ORIGIN = "https://logly.example";
const summary = {
  status: "ok" as const,
  alerts: { sent: 0, failed: 0 },
  digests: { sent: 1, failed: 0, projects: 1 },
  truncated: false,
};

describe("cron", () => {
  const cron = (authorization?: string) =>
    new Request(`${ORIGIN}/api/cron/email`, {
      headers: authorization ? { authorization } : {},
    });

  test("fails closed without CRON_SECRET", async () => {
    let ran = false;
    const response = await handleEmailCron(cron("Bearer "), {
      cronSecret: undefined,
      run: async () => {
        ran = true;
        return summary;
      },
    });
    expect(response.status).toBe(503);
    expect(ran).toBe(false);
  });

  test("rejects a wrong or missing bearer", async () => {
    for (const header of [undefined, "Bearer nope", "secret-123"]) {
      const response = await handleEmailCron(cron(header), {
        cronSecret: "secret-123",
        run: async () => summary,
      });
      expect(response.status).toBe(401);
    }
  });

  test("runs the job with the right bearer", async () => {
    const response = await handleEmailCron(cron("Bearer secret-123"), {
      cronSecret: "secret-123",
      run: async () => summary,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
  });
});

describe("subscriptions", () => {
  const put = (body: unknown, origin = ORIGIN) =>
    new Request(`${ORIGIN}/api/email/subscriptions`, {
      method: "PUT",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const valid = {
    project: "gnd",
    userId: "u1",
    scope: "organization",
    weeklyDigest: true,
    trackingAlerts: false,
  };

  test("parses only complete input", () => {
    expect(parseSubscriptionInput(valid)).toEqual(
      valid as ReturnType<typeof parseSubscriptionInput>,
    );
    expect(parseSubscriptionInput({ ...valid, scope: "all" })).toBeNull();
    expect(
      parseSubscriptionInput({ ...valid, weeklyDigest: "yes" }),
    ).toBeNull();
    expect(parseSubscriptionInput(null)).toBeNull();
  });

  test("admin and same-origin only", async () => {
    const calls: unknown[] = [];
    const deps = (role: string) => ({
      getRole: async () => role,
      save: async (input: unknown) => {
        calls.push(input);
        return "saved" as const;
      },
    });
    expect(
      (
        await handleSetSubscription(
          put(valid, "https://evil.example"),
          deps("admin"),
        )
      ).status,
    ).toBe(403);
    expect((await handleSetSubscription(put(valid), deps("user"))).status).toBe(
      401,
    );
    expect(calls).toHaveLength(0);
    expect((await handleSetSubscription(put({}), deps("admin"))).status).toBe(
      400,
    );
    const ok = await handleSetSubscription(put(valid), deps("admin"));
    expect(ok.status).toBe(200);
    expect(calls).toEqual([valid]);
  });
});

describe("test digest", () => {
  const post = () =>
    new Request(`${ORIGIN}/api/email/test`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ project: "gnd" }),
    });

  test("sends only to the signed-in admin", async () => {
    const sent: unknown[] = [];
    const response = await handleTestDigest(post(), {
      getSessionUser: async () => ({ role: "admin", email: "me@example.com" }),
      transportEnabled: true,
      send: async (input) => {
        sent.push(input);
        return "sent";
      },
    });
    expect(response.status).toBe(200);
    expect(sent).toEqual([{ project: "gnd", to: "me@example.com" }]);
  });

  test("refused when email is disabled or for non-admins", async () => {
    const send = async () => "sent" as const;
    expect(
      (
        await handleTestDigest(post(), {
          getSessionUser: async () => ({ role: "admin", email: "a@b.c" }),
          transportEnabled: false,
          transportReason: "Email is sent only from the production deployment",
          send,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await handleTestDigest(post(), {
          getSessionUser: async () => ({ role: "user", email: "a@b.c" }),
          transportEnabled: true,
          send,
        })
      ).status,
    ).toBe(401);
  });
});

describe("unsubscribe", () => {
  const key = unsubscribeKey("secret");
  const claim = {
    subscriptionId: "11111111-1111-4111-8111-111111111111",
    kind: "digest" as EmailSubscriptionKind,
  };
  const token = createUnsubscribeToken(key, claim);
  const link = `${ORIGIN}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;

  function deps(calls: unknown[]) {
    return {
      verify: (value: string | null) => verifyUnsubscribeToken(key, value),
      unsubscribe: async (input: typeof claim) => {
        calls.push(input);
        return { scope: "organization" as const, name: "Personal <Org>" };
      },
    };
  }

  test("GET only confirms; link prefetchers change nothing", async () => {
    const calls: unknown[] = [];
    const response = await handleUnsubscribe(new Request(link), deps(calls));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('method="post"');
    expect(calls).toHaveLength(0);
  });

  test("POST (button or one-click) unsubscribes without signing in", async () => {
    const calls: unknown[] = [];
    const response = await handleUnsubscribe(
      new Request(link, { method: "POST", body: "List-Unsubscribe=One-Click" }),
      deps(calls),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("any Personal &lt;Org&gt; project");
    expect(calls).toEqual([claim]);
  });

  test("a forged token is rejected", async () => {
    const calls: unknown[] = [];
    const forged = createUnsubscribeToken(unsubscribeKey("other"), claim);
    const response = await handleUnsubscribe(
      new Request(`${ORIGIN}/api/email/unsubscribe?token=${forged}`, {
        method: "POST",
      }),
      deps(calls),
    );
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

test("emailBaseUrl prefers the public dashboard URL", () => {
  expect(
    emailBaseUrl({
      NEXT_PUBLIC_DASHBOARD_URL: "https://logly-chi.vercel.app/x",
      BETTER_AUTH_URL: "https://other",
    }),
  ).toBe("https://logly-chi.vercel.app");
  expect(emailBaseUrl({ BETTER_AUTH_URL: "https://auth.example" })).toBe(
    "https://auth.example",
  );
  expect(emailBaseUrl({})).toBeNull();
});
