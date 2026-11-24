import {
  type AnalyticsGroups,
  actorIdSchema,
  analyticsGroupsSchema,
  type EventProperty,
  sanitizeProperties,
} from "./contracts";

/** In-memory context only. Caller supplies project-scoped opaque references. */
export function createAnalyticsContext() {
  let actorId: string | undefined;
  let groups: AnalyticsGroups = {};
  let properties: Record<string, EventProperty> = {};
  const reset = () => {
    actorId = undefined;
    groups = {};
    properties = {};
  };
  return {
    identify(value: string) {
      const parsed = actorIdSchema.safeParse(value);
      if (!parsed.success) return false;
      if (actorId !== parsed.data) reset();
      actorId = parsed.data;
      return true;
    },
    group(type: string, key: string, metadata?: Record<string, EventProperty>) {
      const parsed = analyticsGroupsSchema.safeParse({
        ...groups,
        [type]: { key, ...(metadata ? { properties: metadata } : {}) },
      });
      if (!parsed.success) return false;
      groups = parsed.data;
      return true;
    },
    clearGroup(type: string) {
      delete groups[type];
    },
    setGlobalProperties(values: Record<string, unknown>) {
      properties = sanitizeProperties({ ...properties, ...values });
    },
    unsetGlobalProperties(keys: string[]) {
      for (const key of keys) delete properties[key];
    },
    reset,
    snapshot(values: Record<string, unknown> = {}) {
      return {
        actorId,
        groups: Object.keys(groups).length
          ? analyticsGroupsSchema.parse(groups)
          : undefined,
        properties: sanitizeProperties({ ...properties, ...values }),
      };
    },
  };
}
export type AnalyticsContextState = ReturnType<typeof createAnalyticsContext>;
export type AnalyticsContextMethods = Pick<
  AnalyticsContextState,
  | "identify"
  | "group"
  | "clearGroup"
  | "setGlobalProperties"
  | "unsetGlobalProperties"
>;
