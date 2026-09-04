import { createHmac, randomUUID } from "node:crypto";
import {
  type AnalyticsBatch,
  analyticsBatchSchema,
  LOGLY_CORE_PACKAGE_NAME,
  sanitizeProperties,
} from "@ishaqyusuf/logly-core";

type ServerAnalyticsConfig = {
  project: string;
  collectorUrl: string;
  serverKey: string;
  timeoutMs?: number;
};

export function signBatch(batch: AnalyticsBatch, secret: string) {
  return createHmac("sha256", secret)
    .update(JSON.stringify(batch))
    .digest("hex");
}

export function createServerAnalytics(config: ServerAnalyticsConfig) {
  return {
    async track(
      name: string,
      properties: Record<string, unknown> = {},
      actorId?: string,
    ) {
      const batch = analyticsBatchSchema.parse({
        sentAt: new Date().toISOString(),
        sdk: { name: LOGLY_CORE_PACKAGE_NAME, version: "0.2.0" },
        events: [
          {
            eventId: randomUUID(),
            project: config.project,
            name,
            version: 1,
            source: "server",
            occurredAt: new Date().toISOString(),
            actorId,
            properties: sanitizeProperties(properties),
          },
        ],
      });

      const body = JSON.stringify(batch);
      const response = await fetch(
        `${config.collectorUrl.replace(/\/$/, "")}/v1/events`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.serverKey}`,
            "x-logly-signature": createHmac("sha256", config.serverKey)
              .update(body)
              .digest("hex"),
          },
          body,
          signal: AbortSignal.timeout(config.timeoutMs ?? 4000),
        },
      );
      if (!response.ok)
        throw new Error(`Logly collector returned ${response.status}`);
      return response.json();
    },
  };
}

export function createAdminClient(config: {
  collectorUrl: string;
  readKey: string;
  timeoutMs?: number;
}) {
  async function read<T>(path: string): Promise<T> {
    const response = await fetch(
      `${config.collectorUrl.replace(/\/$/, "")}${path}`,
      {
        headers: { authorization: `Bearer ${config.readKey}` },
        signal: AbortSignal.timeout(config.timeoutMs ?? 4000),
      },
    );
    if (!response.ok)
      throw new Error(`Logly read API returned ${response.status}`);
    return response.json() as Promise<T>;
  }
  return { read };
}
