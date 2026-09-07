import { analyticsBatchSchema } from "@ishaqyusuf/logly-core";
import {
  getDashboardData,
  getDashboardEventById,
  getDashboardEventFilterOptions,
  getDashboardEventSummary,
  getDashboardFunnel,
  getProjectPolicy,
  ingestEventBatch,
  listDashboardEventPage,
  verifyProjectCredential,
} from "@logly/db/queries";
import { type AnalyticsEventQuery, normalizeFunnelQuery } from "@logly/utils";
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
    await next();
  });

  app.get("/v1/dashboard/overview", async (context) =>
    context.json(
      await getDashboardData(
        context.req.query("project"),
        context.req.query("organization"),
      ),
    ),
  );
  app.get("/v1/dashboard/events", async (context) => {
    const split = (value?: string) => value?.split(",").filter(Boolean);
    const sources = split(context.req.query("sources"))?.filter(
      (source): source is "browser" | "server" =>
        source === "browser" || source === "server",
    );
    const query: AnalyticsEventQuery = {
      organization: context.req.query("organization"),
      project: context.req.query("project"),
      projects: split(context.req.query("projects")),
      names: split(context.req.query("names")),
      sources,
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
      (source): source is "browser" | "server" =>
        source === "browser" || source === "server",
    );
    const query: AnalyticsEventQuery = {
      organization: context.req.query("organization"),
      project: context.req.query("project"),
      names: split(context.req.query("names")),
      sources,
      q: context.req.query("q"),
      start: context.req.query("start"),
      end: context.req.query("end"),
    };
    if (!query.project) {
      return context.json({ error: "Project is required" }, 400);
    }
    return context.json(await getDashboardEventSummary(query));
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
