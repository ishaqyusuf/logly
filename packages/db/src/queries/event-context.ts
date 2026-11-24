import { createHmac } from "node:crypto";
import type { ContextFilters, EventGroups } from "@logly/utils";
import { parsePropertyValue } from "@logly/utils";
import { and, eq, sql } from "drizzle-orm";
import { analyticsEvents } from "../schema";

export function hashEventGroups(
  groups: EventGroups | undefined,
  secret: string,
  projectId: string,
): EventGroups {
  return Object.fromEntries(
    Object.entries(groups ?? {}).map(([type, group]) => [
      type,
      {
        key: createHmac("sha256", secret)
          .update(JSON.stringify(["group", projectId, type, group.key]))
          .digest("hex"),
        properties: { ...group.properties },
      },
    ]),
  );
}

export function eventContextConditions(query: ContextFilters) {
  return and(
    query.actor ? eq(analyticsEvents.actorId, query.actor) : undefined,
    query.groupType
      ? query.groupKey
        ? sql`${analyticsEvents.groups} @> ${JSON.stringify({ [query.groupType]: { key: query.groupKey } })}::jsonb`
        : sql`${analyticsEvents.groups} ? ${query.groupType}`
      : undefined,
    query.propertyKey && query.propertyValue !== undefined
      ? sql`${analyticsEvents.properties} @> ${JSON.stringify({ [query.propertyKey]: parsePropertyValue(query.propertyValue) })}::jsonb`
      : undefined,
  );
}
