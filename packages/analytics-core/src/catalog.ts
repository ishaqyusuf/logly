import type { EventProperty } from "./contracts";

type EventDefinition = { properties?: Record<string, EventProperty> };

export function defineEventCatalog<
  const T extends Record<string, EventDefinition>,
>(catalog: T) {
  return catalog;
}

export type EventCatalog = ReturnType<typeof defineEventCatalog>;
