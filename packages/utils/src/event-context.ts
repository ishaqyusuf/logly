export type AnalyticsScalar = string | number | boolean | null;
export type EventGroups = Record<
  string,
  { key: string; properties?: Record<string, AnalyticsScalar> }
>;

export const contextFilterKeys = [
  "groupType",
  "groupKey",
  "actor",
  "propertyKey",
  "propertyValue",
] as const;
export type ContextFilters = Partial<
  Record<(typeof contextFilterKeys)[number], string>
>;

// Property values use JSON scalars so 3, "3", false and null remain distinct.
export function parsePropertyValue(value: string): AnalyticsScalar {
  const parsed: unknown = JSON.parse(value);
  if (
    parsed === null ||
    typeof parsed === "boolean" ||
    (typeof parsed === "string" && parsed.length <= 256) ||
    (typeof parsed === "number" && Number.isFinite(parsed))
  )
    return parsed;
  throw new Error("Property value must be a bounded JSON scalar");
}

export function readContextFilters(params: {
  get: (key: string) => string | null;
}): ContextFilters {
  const result: ContextFilters = {};
  for (const key of contextFilterKeys) {
    const value = params.get(key);
    if (value !== null && value !== "") result[key] = value;
  }
  if (result.groupType && !/^[a-z][a-z0-9_]{0,63}$/.test(result.groupType))
    throw new Error("Invalid group type");
  if (result.groupKey && (!result.groupType || result.groupKey.length > 128))
    throw new Error("Group key requires a group type");
  if (result.actor && result.actor.length > 128)
    throw new Error("Invalid actor reference");
  if (result.propertyKey && result.propertyKey.length > 64)
    throw new Error("Invalid property key");
  if (Boolean(result.propertyKey) !== (result.propertyValue !== undefined))
    throw new Error("Property key and value are required together");
  if (result.propertyValue !== undefined)
    parsePropertyValue(result.propertyValue);
  return result;
}

export function matchesEventContext(
  event: {
    actorId?: string | null;
    groups?: EventGroups;
    properties: Record<string, AnalyticsScalar>;
  },
  query: ContextFilters,
) {
  if (query.actor && event.actorId !== query.actor) return false;
  if (query.groupType) {
    const group = event.groups?.[query.groupType];
    if (!group || (query.groupKey && group.key !== query.groupKey))
      return false;
  }
  if (query.propertyKey && query.propertyValue !== undefined) {
    if (!Object.hasOwn(event.properties, query.propertyKey)) return false;
    if (
      event.properties[query.propertyKey] !==
      parsePropertyValue(query.propertyValue)
    )
      return false;
  }
  return true;
}

export type AnalyticsGroupOption = { type: string; key: string; name: string };
