import { expect, test } from "bun:test";
import {
  type AnalyticsEventRow,
  actorReadFields,
  matchesActorRead,
  parseActorReadQuery,
  summarizeAnalyticsEvents,
} from "@logly/utils";

const actor = "a".repeat(64);
test("actor filter accepts stored pseudonyms and rejects raw IDs or query fragments", () => {
  expect(parseActorReadQuery(actor)).toEqual({ actor });
  expect(parseActorReadQuery("")).toEqual({});
  for (const value of [
    "user-id",
    "user@example.com",
    `${actor}'`,
    "A".repeat(64),
    "b".repeat(65),
  ])
    expect(() => parseActorReadQuery(value)).toThrow("Invalid event actor");
});
test("only the stored pseudonymous actor is exposed", () => {
  expect(actorReadFields({ actorId: actor })).toEqual({ actorId: actor });
  expect(actorReadFields({})).toEqual({ actorId: null });
  expect(matchesActorRead({ actorId: actor }, { actor })).toBe(true);
  expect(matchesActorRead({ actorId: "b".repeat(64) }, { actor })).toBe(false);
  expect(matchesActorRead({}, { actor })).toBe(false);
});
test("complete summaries keep actor, project and time filters together", () => {
  const event: AnalyticsEventRow = {
    id: "one",
    name: "created",
    project: "afterservice",
    source: "server",
    visitorKey: null,
    visitKind: null,
    route: null,
    referrerHost: null,
    occurredAt: "2026-11-08T12:00:00.000Z",
    properties: {},
    actorId: actor,
  };
  const events = [
    event,
    { ...event, id: "two", actorId: "b".repeat(64) },
    { ...event, id: "three", project: "ewatrade" },
    { ...event, id: "four", occurredAt: "2026-10-01T12:00:00.000Z" },
  ];
  const result = summarizeAnalyticsEvents(events, {
    project: "afterservice",
    actor,
    start: "2026-11-08T00:00:00.000Z",
    end: "2026-11-08T23:59:59.000Z",
  });
  expect(result.totalEvents).toBe(1);
  expect(result.eventNames[0]?.count).toBe(1);
});
