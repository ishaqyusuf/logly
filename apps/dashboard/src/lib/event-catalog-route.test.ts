import { expect, test } from "bun:test";
import type { EventCatalogInput } from "@logly/utils";
import {
  type EventCatalogRouteDependencies,
  handleSaveEventCatalog,
} from "./event-catalog-route";

const body = {
  project: "gnd",
  name: "quote_open",
  description: "Legacy name for quote_opened",
  notes: "Owner: sales team",
  deprecated: true,
  hidden: true,
};

function deps(
  role: string | null = "admin",
  saved: EventCatalogInput[] = [],
  status: "saved" | "project_not_found" | "limit" = "saved",
): EventCatalogRouteDependencies {
  return {
    getRole: async () => role,
    save: async (input) => {
      saved.push(input);
      return status === "saved"
        ? {
            status,
            metadata: {
              ...input,
              updatedAt: "2026-11-24T10:00:00.000Z",
            },
          }
        : { status };
    },
  };
}

function request(payload: unknown, origin = "https://logly.example") {
  return new Request("https://logly.example/api/event-catalog", {
    method: "PUT",
    headers: { origin, "content-type": "application/json" },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

test("an admin saves event metadata", async () => {
  const saved: EventCatalogInput[] = [];
  const response = await handleSaveEventCatalog(
    request({ ...body, description: "  Legacy name for quote_opened  " }),
    deps("admin", saved),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(saved).toEqual([body]);
});

test("non-admins and cross-origin requests are refused before saving", async () => {
  const saved: EventCatalogInput[] = [];
  expect(
    (await handleSaveEventCatalog(request(body), deps("member", saved))).status,
  ).toBe(401);
  expect(
    (await handleSaveEventCatalog(request(body), deps(null, saved))).status,
  ).toBe(401);
  expect(
    (
      await handleSaveEventCatalog(
        request(body, "https://evil.example"),
        deps("admin", saved),
      )
    ).status,
  ).toBe(403);
  expect(saved).toEqual([]);
});

test("invalid metadata is rejected", async () => {
  for (const payload of [
    "not json",
    { ...body, name: "Quote Opened" },
    { ...body, project: "" },
    { ...body, description: "x".repeat(281) },
    { ...body, notes: 4 },
    { ...body, hidden: "yes" },
  ])
    expect(
      (await handleSaveEventCatalog(request(payload), deps())).status,
    ).toBe(400);
  expect(
    (
      await handleSaveEventCatalog(
        request({ ...body, notes: "x".repeat(5_000) }),
        deps(),
      )
    ).status,
  ).toBe(413);
});

test("missing projects and the metadata limit are reported", async () => {
  expect(
    (
      await handleSaveEventCatalog(
        request(body),
        deps("admin", [], "project_not_found"),
      )
    ).status,
  ).toBe(404);
  expect(
    (await handleSaveEventCatalog(request(body), deps("admin", [], "limit")))
      .status,
  ).toBe(409);
});
