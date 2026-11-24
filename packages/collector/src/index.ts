import { analyticsBatchSchema } from "@ishaqyusuf/logly-core";
import {
  getDashboardAppVersions,
  getDashboardBreakdown,
  getDashboardData,
  getDashboardEventById,
  getDashboardEventFilterOptions,
  getDashboardEventSummary,
  getDashboardFunnel,
  getDashboardPages,
  getProjectPolicy,
  getTrackingAlertsReport,
  ingestEventBatch,
  listDashboardEventPage,
  listDashboardGroups,
  listReleases,
  recordRelease,
  refreshTrackingAlerts,
  verifyProjectCredential,
} from "@logly/db/queries";
import {
  type AnalyticsEventQuery,
  BreakdownQueryError,
  normalizeFunnelQuery,
  parseActorReadQuery,
  parseBreakdownQuery,
  parsePageViewEvent,
  parseReleaseInput,
  RELEASE_MAX_BODY_BYTES,
  readContextFilters,
} from "@logly/utils";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import {
  getRequiredHashSecret,
  isAllowedOrigin,
  verifyBatchSignature,
} from "./security";

export {
  isAllowedOrigin,
  normalizeOrigin,
  verifyBatchSignature,
} from "./security";

export function createCollectorApp() {
  const app = new Hono();
  const windows = new Map<string, { count: number; resetAt: number }>();

  app.use("*", secureHeaders());

  app.use("/v1/events", async (context, next) => {
    const key = context.req.header("x-forwarded-for") ?? "local";
    const now = Date.now();
    const window = windows.get(key);
    if (!window || window.resetAt < now) {
      windows.set(key, { count: 1, resetAt: now + 60_000 });
    } else if (++window.count > 120) {
      return context.json({ error: "Rate limit exceeded" }, 429);
    }
    await next();
  });

  // Releases arrive from CI once per deploy; 30 a minute per client is ample.
  const releaseWindows = new Map<string, { count: number; resetAt: number }>();
  app.use("/v1/releases", async (context, next) => {
    const key = context.req.header("x-forwarded-for") ?? "local";
    const now = Date.now();
    const window = releaseWindows.get(key);
    if (!window || window.resetAt < now) {
      releaseWindows.set(key, { count: 1, resetAt: now + 60_000 });
    } else if (++window.count > 30) {
      return context.json({ error: "Rate limit exceeded" }, 429);
    }
    await next();
  });

  app.get("/health", (context) =>
    context.json({ status: "ok", service: "logly-collector" }),
  );

  app.post("/v1/events", async (context) => {
    const body = await context.req.text();
    const parsed = analyticsBatchSchema.safeParse(
      (() => {
        try {
          return JSON.parse(body);
        } catch {
          return null;
        }
      })(),
    );
    if (!parsed.success) {
      return context.json(
        { error: "Invalid event batch", issues: parsed.error.issues },
        400,
      );
    }

    const projectSlug = parsed.data.events[0]?.project;
    if (!projectSlug) return context.json({ error: "Missing project" }, 400);

    const projectKey = context.req.header("x-logly-project-key");
    const bearer = context.req
      .header("authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (projectKey) {
      const [authenticated, policy] = await Promise.all([
        verifyProjectCredential(projectSlug, projectKey, "client-ingest"),
        getProjectPolicy(projectSlug),
      ]);
      if (!authenticated) return context.json({ error: "Unauthorized" }, 401);
      if (
        !policy ||
        !isAllowedOrigin(
          context.req.header("x-logly-origin") ?? null,
          policy.allowedOrigins,
        )
      ) {
        return context.json({ error: "Origin not allowed" }, 403);
      }
    } else {
      const authenticated = Boolean(
        bearer &&
          ((process.env.LOGLY_SERVER_KEY &&
            bearer === process.env.LOGLY_SERVER_KEY) ||
            (await verifyProjectCredential(
              projectSlug,
              bearer,
              "server-write",
            ))),
      );
      if (!authenticated || !bearer) {
        return context.json({ error: "Unauthorized" }, 401);
      }
      if (
        !verifyBatchSignature(
          body,
          bearer,
          context.req.header("x-logly-signature") ?? null,
        )
      ) {
        return context.json({ error: "Invalid signature" }, 401);
      }
    }

    try {
      return context.json(
        await ingestEventBatch(
          parsed.data,
          getRequiredHashSecret(),
          projectKey ? context.req.header("x-logly-country") : null,
        ),
        202,
      );
    } catch (error) {
      return context.json(
        { error: error instanceof Error ? error.message : "Ingestion failed" },
        400,
      );
    }
  });

  app.post("/v1/releases", async (context) => {
    if (
      Number(context.req.header("content-length") ?? 0) > RELEASE_MAX_BODY_BYTES
    ) {
      return context.json({ error: "Release body too large" }, 413);
    }
    const body = await context.req.text();
    if (Buffer.byteLength(body) > RELEASE_MAX_BODY_BYTES) {
      return context.json({ error: "Release body too large" }, 413);
    }
    const parsed = parseReleaseInput(
      (() => {
        try {
          return JSON.parse(body);
        } catch {
          return null;
        }
      })(),
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    // Same trusted-writer model as server ingest: a server-write project key
    // (or the global server key) as the bearer, and an HMAC of the raw body.
    const bearer = context.req
      .header("authorization")
      ?.replace(/^Bearer\s+/i, "");
    const authenticated = Boolean(
      bearer &&
        ((process.env.LOGLY_SERVER_KEY &&
          bearer === process.env.LOGLY_SERVER_KEY) ||
          (await verifyProjectCredential(
            parsed.data.project,
            bearer,
            "server-write",
          ))),
    );
    if (!authenticated || !bearer) {
      return context.json({ error: "Unauthorized" }, 401);
    }
    if (
      !verifyBatchSignature(
        body,
        bearer,
        context.req.header("x-logly-signature") ?? null,
      )
    ) {
      return context.json({ error: "Invalid signature" }, 401);
    }

    try {
      const result = await recordRelease({ ...parsed.data, source: "api" });
      if (result.status === "project_not_found") {
        return context.json({ error: "Project not found" }, 404);
      }
      return context.json(
        { created: result.status === "created", release: result.release },
        result.status === "created" ? 201 : 200,
      );
    } catch {
      return context.json({ error: "Could not record the release" }, 503);
    }
  });

  app.use("/v1/dashboard/*", async (context, next) => {
    const configured = process.env.LOGLY_READ_KEY;
    const bearer = context.req
      .header("authorization")
      ?.replace(/^Bearer\s+/i, "");
    const project = context.req.query("project");
    const globallyAuthorized = Boolean(configured && bearer === configured);
    const projectAuthorized = Boolean(
      project &&
        bearer &&
        (await verifyProjectCredential(project, bearer, "read")),
    );
    const demoRead = process.env.NODE_ENV !== "production" && !configured;

    if (!globallyAuthorized && !projectAuthorized && !demoRead) {
      return context.json({ error: "Unauthorized" }, 401);
    }
    try {
      readContextFilters({ get: (key) => context.req.query(key) ?? null });
    } catch {
      return context.json({ error: "Invalid event context filter" }, 400);
    }
    try {
      parseActorReadQuery(context.req.query("actor"));
    } catch {
      return context.json({ error: "Invalid event actor" }, 400);
    }
    await next();
  });

  app.get("/v1/dashboard/groups", async (context) => {
    const project = context.req.query("project");
    if (!project) return context.json({ error: "Project is required" }, 400);
    return context.json(
      await listDashboardGroups({ project, q: context.req.query("q") }),
    );
  });

  app.get("/v1/dashboard/overview", async (context) => {
    // Tracking-quiet alerts are evaluated on read, throttled per project.
    await refreshTrackingAlerts();
    return context.json(
      await getDashboardData(
        context.req.query("project"),
        context.req.query("organization"),
        (["24h", "7d", "30d"] as const).find(
          (range) => range === context.req.query("range"),
        ),
      ),
    );
  });
  app.get("/v1/dashboard/pages", async (context) => {
    const project = context.req.query("project");
    if (!project) return context.json({ error: "Project is required" }, 400);
    const range = (["24h", "7d", "30d"] as const).find(
      (option) => option === (context.req.query("range") ?? "7d"),
    );
    const viewParam = context.req.query("view");
    const view = parsePageViewEvent(viewParam);
    if (!range || (viewParam && !view)) {
      return context.json({ error: "Invalid pages query" }, 400);
    }
    return context.json(
      await getDashboardPages({
        project,
        organization: context.req.query("organization"),
        range,
        view,
      }),
    );
  });
  app.get("/v1/dashboard/releases", async (context) => {
    const project = context.req.query("project");
    if (!project) return context.json({ error: "Project is required" }, 400);
    const time = (key: string) => {
      const value = context.req.query(key);
      if (!value) return undefined;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const start = time("start");
    const end = time("end");
    const environment = context.req.query("environment");
    if (
      start === null ||
      end === null ||
      (environment && environment !== "production" && environment !== "preview")
    ) {
      return context.json({ error: "Invalid releases query" }, 400);
    }
    return context.json({
      data: await listReleases({
        project,
        start,
        end,
        environment: environment as "production" | "preview" | undefined,
        limit: Number(context.req.query("limit")) || undefined,
      }),
    });
  });
  app.get("/v1/dashboard/app-versions", async (context) => {
    const project = context.req.query("project");
    if (!project) return context.json({ error: "Project is required" }, 400);
    const range = (["24h", "7d", "30d"] as const).find(
      (option) => option === (context.req.query("range") ?? "7d"),
    );
    if (!range) return context.json({ error: "Invalid range" }, 400);
    return context.json(
      await getDashboardAppVersions({
        project,
        organization: context.req.query("organization"),
        range,
      }),
    );
  });
  app.get("/v1/dashboard/tracking-alerts", async (context) => {
    const project = context.req.query("project");
    if (!project) return context.json({ error: "Project is required" }, 400);
    await refreshTrackingAlerts();
    const report = await getTrackingAlertsReport({ project });
    return report
      ? context.json(report)
      : context.json({ error: "Project not found" }, 404);
  });
  app.get("/v1/dashboard/events", async (context) => {
    const split = (value?: string) => value?.split(",").filter(Boolean);
    const sources = split(context.req.query("sources"))?.filter(
      (source): source is "browser" | "server" | "mobile" =>
        source === "browser" || source === "server" || source === "mobile",
    );
    const platforms = split(context.req.query("platforms"))?.filter(
      (platform): platform is "web" | "ios" | "android" =>
        platform === "web" || platform === "ios" || platform === "android",
    );
    const query: AnalyticsEventQuery = {
      ...parseActorReadQuery(context.req.query("actor")),
      ...readContextFilters({ get: (key) => context.req.query(key) ?? null }),
      organization: context.req.query("organization"),
      project: context.req.query("project"),
      projects: split(context.req.query("projects")),
      names: split(context.req.query("names")),
      sources,
      platforms,
      q: context.req.query("q"),
      start: context.req.query("start"),
      end: context.req.query("end"),
      sort: context.req.query("sort") as AnalyticsEventQuery["sort"],
      cursor: context.req.query("cursor"),
      pageSize: Number(context.req.query("pageSize")) || undefined,
    };
    return context.json(await listDashboardEventPage(query));
  });
  app.get("/v1/dashboard/funnel", async (context) => {
    let query: ReturnType<typeof normalizeFunnelQuery>;
    try {
      query = normalizeFunnelQuery({
        project: context.req.query("project") ?? "",
        organization: context.req.query("organization"),
        steps: context.req.query("steps")?.split(",") ?? [],
        start: context.req.query("start"),
        end: context.req.query("end"),
      });
    } catch (error) {
      return context.json(
        { error: error instanceof Error ? error.message : "Invalid funnel" },
        400,
      );
    }
    return context.json(await getDashboardFunnel(query));
  });
  app.get("/v1/dashboard/event-summary", async (context) => {
    const split = (value?: string) => value?.split(",").filter(Boolean);
    const sources = split(context.req.query("sources"))?.filter(
      (source): source is "browser" | "server" | "mobile" =>
        source === "browser" || source === "server" || source === "mobile",
    );
    const platforms = split(context.req.query("platforms"))?.filter(
      (platform): platform is "web" | "ios" | "android" =>
        platform === "web" || platform === "ios" || platform === "android",
    );
    const query: AnalyticsEventQuery = {
      ...parseActorReadQuery(context.req.query("actor")),
      ...readContextFilters({ get: (key) => context.req.query(key) ?? null }),
      organization: context.req.query("organization"),
      project: context.req.query("project"),
      names: split(context.req.query("names")),
      sources,
      platforms,
      q: context.req.query("q"),
      start: context.req.query("start"),
      end: context.req.query("end"),
    };
    if (!query.project) {
      return context.json({ error: "Project is required" }, 400);
    }
    return context.json(await getDashboardEventSummary(query));
  });
  app.get("/v1/dashboard/breakdown", async (context) => {
    let query: ReturnType<typeof parseBreakdownQuery>;
    try {
      query = parseBreakdownQuery({
        get: (key) => context.req.query(key) ?? null,
      });
    } catch (error) {
      if (error instanceof BreakdownQueryError)
        return context.json({ error: error.message }, 400);
      throw error;
    }
    const result = await getDashboardBreakdown(query);
    return result
      ? context.json(result)
      : context.json(
          { error: "Breakdown requires the analytics database" },
          503,
        );
  });
  app.get("/v1/dashboard/events/:eventId", async (context) => {
    const project = context.req.query("project");
    if (!project) return context.json({ error: "Project is required" }, 400);
    const event = await getDashboardEventById(
      context.req.param("eventId"),
      project,
    );
    return event
      ? context.json(event)
      : context.json({ error: "Event not found" }, 404);
  });
  app.get("/v1/dashboard/event-options", async (context) =>
    context.json(
      await getDashboardEventFilterOptions({
        project: context.req.query("project"),
        organization: context.req.query("organization"),
      }),
    ),
  );
  app.get("/v1/dashboard/projects", async (context) => {
    const data = await getDashboardData(
      context.req.query("project"),
      context.req.query("organization"),
    );
    return context.json({ data: data.projects });
  });

  return app;
}

export const collectorApp = createCollectorApp();
