import { timingSafeEqual } from "node:crypto";
import type {
  EmailJobSummary,
  EmailSubscriptionKind,
  RenderedEmail,
} from "@logly/email";
import { isTrustedSameOrigin } from "./request-origin";

/**
 * Request handling for the email channel, with dependencies injected so the
 * auth, validation and idempotency rules are testable without a database or
 * provider.
 */

function reply(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// --- Cron --------------------------------------------------------------------

export type CronDependencies = {
  cronSecret: string | undefined;
  run: () => Promise<EmailJobSummary>;
};

function bearerMatches(header: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`. */
export async function handleEmailCron(
  request: Request,
  dependencies: CronDependencies,
) {
  // Fail closed: without a secret the job cannot be triggered at all.
  if (!dependencies.cronSecret)
    return reply({ error: "CRON_SECRET is not configured" }, 503);
  if (
    !bearerMatches(
      request.headers.get("authorization"),
      dependencies.cronSecret,
    )
  )
    return reply({ error: "Unauthorized" }, 401);
  try {
    return reply(await dependencies.run(), 200);
  } catch (error) {
    console.error("Email job failed", error);
    return reply({ error: "Email job failed" }, 500);
  }
}

// --- Subscriptions (admin) ---------------------------------------------------

export type SubscriptionInput = {
  project: string;
  userId: string;
  scope: "project" | "organization";
  weeklyDigest: boolean;
  trackingAlerts: boolean;
};

export type SubscriptionDependencies = {
  getRole: () => Promise<string | null | undefined>;
  save: (
    input: SubscriptionInput,
  ) => Promise<"saved" | "removed" | "project_not_found" | "user_not_found">;
};

export function parseSubscriptionInput(
  body: unknown,
): SubscriptionInput | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  if (
    typeof value.project !== "string" ||
    !value.project ||
    value.project.length > 120 ||
    typeof value.userId !== "string" ||
    !value.userId ||
    value.userId.length > 200 ||
    (value.scope !== "project" && value.scope !== "organization") ||
    typeof value.weeklyDigest !== "boolean" ||
    typeof value.trackingAlerts !== "boolean"
  )
    return null;
  return {
    project: value.project,
    userId: value.userId,
    scope: value.scope,
    weeklyDigest: value.weeklyDigest,
    trackingAlerts: value.trackingAlerts,
  };
}

async function authorizeAdmin(
  request: Request,
  getRole: () => Promise<string | null | undefined>,
) {
  if (!isTrustedSameOrigin(request))
    return reply({ error: "Invalid request origin" }, 403);
  if ((await getRole()) !== "admin")
    return reply({ error: "Unauthorized" }, 401);
  return null;
}

async function readJson(request: Request) {
  const text = await request.text().catch(() => "");
  if (text.length > 2_000) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function handleSetSubscription(
  request: Request,
  dependencies: SubscriptionDependencies,
) {
  const denied = await authorizeAdmin(request, dependencies.getRole);
  if (denied) return denied;
  const body = await readJson(request);
  if (body === undefined) return reply({ error: "Body too large" }, 413);
  const input = parseSubscriptionInput(body);
  if (!input) return reply({ error: "Invalid subscription" }, 400);
  try {
    const status = await dependencies.save(input);
    if (status === "project_not_found")
      return reply({ error: "Project not found" }, 404);
    if (status === "user_not_found")
      return reply({ error: "Operator not found" }, 404);
    return reply({ status }, 200);
  } catch {
    return reply({ error: "Could not save the subscription" }, 500);
  }
}

// --- Test digest (admin) -----------------------------------------------------

export type TestDigestDependencies = {
  getSessionUser: () => Promise<{ role?: string | null; email: string } | null>;
  transportEnabled: boolean;
  transportReason?: string;
  send: (input: {
    project: string;
    to: string;
  }) => Promise<"sent" | "failed" | "project_not_found">;
};

export async function handleTestDigest(
  request: Request,
  dependencies: TestDigestDependencies,
) {
  if (!isTrustedSameOrigin(request))
    return reply({ error: "Invalid request origin" }, 403);
  const user = await dependencies.getSessionUser();
  if (user?.role !== "admin") return reply({ error: "Unauthorized" }, 401);
  const body = (await readJson(request)) as { project?: unknown } | null;
  if (typeof body?.project !== "string" || !body.project)
    return reply({ error: "project is required" }, 400);
  if (!dependencies.transportEnabled)
    return reply(
      {
        error: `${dependencies.transportReason ?? "Email is disabled"}. Use the preview instead.`,
      },
      409,
    );
  const result = await dependencies.send({
    project: body.project,
    to: user.email,
  });
  if (result === "project_not_found")
    return reply({ error: "Project not found" }, 404);
  if (result === "failed")
    return reply({ error: "The provider rejected the message" }, 502);
  return reply({ sent: true }, 200);
}

// --- Unsubscribe (public, signed token) -------------------------------------

export type UnsubscribeDependencies = {
  verify: (
    token: string | null,
  ) => { subscriptionId: string; kind: EmailSubscriptionKind } | null;
  unsubscribe: (claim: {
    subscriptionId: string;
    kind: EmailSubscriptionKind;
  }) => Promise<{ scope: "project" | "organization"; name: string } | null>;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f4f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
<main style="max-width:420px;margin:64px auto;padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;">
<p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#347b56;font-weight:600;">Logly</p>
<h1 style="margin:8px 0 0;font-size:20px;">${escapeHtml(title)}</h1>
${body}
</main></body></html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}

const kindLabel = (kind: EmailSubscriptionKind) =>
  kind === "digest" ? "weekly digests" : "tracking-alert emails";

/**
 * GET shows a confirmation button and changes nothing, so mail scanners
 * that prefetch links cannot unsubscribe anyone. POST (the button, or a
 * mail client's RFC 8058 one-click request) performs it.
 */
export async function handleUnsubscribe(
  request: Request,
  dependencies: UnsubscribeDependencies,
) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const claim = dependencies.verify(token);
  if (!claim)
    return page(
      "Link not valid",
      `<p style="font-size:14px;line-height:22px;color:#4b5563;">This unsubscribe link is invalid or has expired. Ask a Logly admin to change your email settings.</p>`,
      400,
    );
  if (request.method === "GET") {
    return page(
      `Unsubscribe from ${kindLabel(claim.kind)}?`,
      `<form method="post" action="${escapeHtml(`${url.pathname}?${url.searchParams}`)}">
<button type="submit" style="margin-top:16px;background:#1f5c3f;color:#fff;border:0;border-radius:6px;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer;">Unsubscribe</button>
</form>`,
    );
  }
  try {
    const result = await dependencies.unsubscribe(claim);
    if (!result)
      return page(
        "Already unsubscribed",
        `<p style="font-size:14px;line-height:22px;color:#4b5563;">You no longer receive these emails.</p>`,
      );
    const scope =
      result.scope === "organization"
        ? `any ${escapeHtml(result.name)} project`
        : escapeHtml(result.name);
    return page(
      "Unsubscribed",
      `<p style="font-size:14px;line-height:22px;color:#4b5563;">You won't receive ${kindLabel(claim.kind)} for ${scope}. An admin can turn them back on in Settings.</p>`,
    );
  } catch {
    return page(
      "Something went wrong",
      `<p style="font-size:14px;line-height:22px;color:#4b5563;">Please try the link again later.</p>`,
      500,
    );
  }
}

// --- Preview (admin) ---------------------------------------------------------

export function previewResponse(email: RenderedEmail, format: string | null) {
  if (format === "text")
    return new Response(`Subject: ${email.subject}\n\n${email.text}`, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  return new Response(email.html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Preview only: no scripts in the email, and keep it out of frames elsewhere.
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; frame-ancestors 'self'",
    },
  });
}
