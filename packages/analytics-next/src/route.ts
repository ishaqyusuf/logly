import {
  type AnalyticsBatch,
  analyticsBatchSchema,
} from "@ishaqyusuf/logly-core";

type RouteOptions = {
  collectorUrl?: string;
  projectKey?: string;
  serverKey?: string;
  onBatch?: (batch: AnalyticsBatch, request: Request) => Promise<void>;
};

export function createAnalyticsRoute(options: RouteOptions) {
  return async function POST(request: Request) {
    const parsed = analyticsBatchSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid analytics batch" },
        { status: 400 },
      );
    }

    if (options.onBatch) {
      await options.onBatch(parsed.data, request);
      return Response.json(
        { accepted: parsed.data.events.length, mode: "local" },
        { status: 202 },
      );
    }

    if (!options.collectorUrl) {
      return Response.json(
        { accepted: parsed.data.events.length, mode: "demo" },
        { status: 202 },
      );
    }

    const origin = request.headers.get("origin");
    const response = await fetch(
      `${options.collectorUrl.replace(/\/$/, "")}/v1/events`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.projectKey
            ? { "x-logly-project-key": options.projectKey }
            : {}),
          ...(options.serverKey
            ? { authorization: `Bearer ${options.serverKey}` }
            : {}),
          ...(origin ? { "x-logly-origin": origin } : {}),
        },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(4000),
      },
    );

    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  };
}
