import { z } from "zod";

export const LOGLY_CORE_PACKAGE_NAME = "@ishaqyusuf/logly-core" as const;
export const LOGLY_CORE_VERSION = "0.3.0" as const;
export const SYSTEM_EVENT_NAMES = [
  "site_visit",
  "page_view",
  "app_session",
  "screen_view",
] as const;

export const analyticsSourceSchema = z.enum(["browser", "server", "mobile"]);
export const analyticsPlatformSchema = z.enum(["web", "ios", "android"]);

export function isSystemEventName(name: string) {
  return SYSTEM_EVENT_NAMES.some((systemName) => systemName === name);
}

export const eventPropertySchema = z.union([
  z.string().max(256),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const actorIdSchema = z.string().min(3).max(128);
export const analyticsGroupTypeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/);
export const analyticsGroupSchema = z.object({
  key: z.string().min(1).max(128),
  properties: z
    .record(z.string().min(1).max(64), eventPropertySchema)
    .refine(
      (value) => Object.keys(value).length <= 20,
      "Groups may contain at most 20 properties",
    )
    .optional(),
});
export const analyticsGroupsSchema = z
  .record(analyticsGroupTypeSchema, analyticsGroupSchema)
  .refine(
    (value) => Object.keys(value).length <= 5,
    "Events may contain at most 5 groups",
  );
export type AnalyticsGroup = z.infer<typeof analyticsGroupSchema>;
export type AnalyticsGroups = z.infer<typeof analyticsGroupsSchema>;

export const eventNameSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_.]*$/, "Use lowercase event names");

export const analyticsEventSchema = z
  .object({
    eventId: z.string().uuid(),
    project: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9-]+$/),
    name: eventNameSchema,
    version: z.number().int().min(1).max(99).default(1),
    source: analyticsSourceSchema,
    platform: analyticsPlatformSchema.optional(),
    appVersion: z.string().min(1).max(64).optional(),
    appBuild: z.string().min(1).max(64).optional(),
    occurredAt: z.string().datetime(),
    visitorId: z.string().min(8).max(128).optional(),
    actorId: actorIdSchema.optional(),
    groups: analyticsGroupsSchema.optional(),
    visitKind: z.enum(["new", "returning"]).optional(),
    route: z.string().max(256).optional(),
    referrerHost: z.string().max(160).optional(),
    properties: z
      .record(z.string(), eventPropertySchema)
      .refine(
        (value) => Object.keys(value).length <= 20,
        "Events may contain at most 20 properties",
      ),
    campaign: z
      .object({
        source: z.string().max(100).optional(),
        medium: z.string().max(100).optional(),
        campaign: z.string().max(100).optional(),
      })
      .optional(),
  })
  .superRefine((event, context) => {
    if (!fitsAnalyticsEventBudget(event)) {
      context.addIssue({
        code: "custom",
        message: "Event exceeds the 47 KiB byte budget",
      });
    }
    if (
      event.source === "mobile" &&
      event.platform !== "ios" &&
      event.platform !== "android"
    ) {
      context.addIssue({
        code: "custom",
        path: ["platform"],
        message: "Mobile events require an iOS or Android platform",
      });
    }
    if (
      event.source === "browser" &&
      event.platform &&
      event.platform !== "web"
    ) {
      context.addIssue({
        code: "custom",
        path: ["platform"],
        message: "Browser events may only use the web platform",
      });
    }
  });

export const analyticsBatchSchema = z.object({
  sentAt: z.string().datetime(),
  sdk: z.object({
    name: z.literal(LOGLY_CORE_PACKAGE_NAME),
    version: z.string(),
  }),
  events: z.array(analyticsEventSchema).min(1).max(25),
});

export type EventProperty = z.infer<typeof eventPropertySchema>;
export type AnalyticsSource = z.infer<typeof analyticsSourceSchema>;
export type AnalyticsPlatform = z.infer<typeof analyticsPlatformSchema>;
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type AnalyticsBatch = z.infer<typeof analyticsBatchSchema>;

export function sanitizeProperties(
  input: Record<string, unknown> = {},
): Record<string, EventProperty> {
  const output: Record<string, EventProperty> = {};

  for (const [key, rawValue] of Object.entries(input).slice(0, 20)) {
    const value =
      typeof rawValue === "string" ? rawValue.slice(0, 256) : rawValue;
    const parsed = eventPropertySchema.safeParse(value);
    if (parsed.success) output[key.slice(0, 64)] = parsed.data;
  }

  return output;
}

/** Leave room for the batch envelope and JSON separators inside 48 KiB. */
export const MAX_ANALYTICS_EVENT_BYTES = 47 * 1024;
export function fitsAnalyticsEventBudget(event: unknown) {
  return (
    new TextEncoder().encode(JSON.stringify(event)).byteLength <=
    MAX_ANALYTICS_EVENT_BYTES
  );
}
