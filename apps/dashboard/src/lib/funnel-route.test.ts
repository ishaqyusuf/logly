import { expect, test } from "bun:test";
import {
  type FunnelRouteDependencies,
  handleCreateFunnel,
  handleDeleteFunnel,
  handleUpdateFunnel,
} from "./funnel-route";

const id = "00000000-0000-4000-8000-000000000001";
const funnel = {
  id,
  name: "Quotes",
  steps: [{ event: "quote_opened" }, { event: "quote_accepted" }],
  window: "7d" as const,
  createdAt: "2026-11-24T10:00:00.000Z",
  updatedAt: "2026-11-24T10:00:00.000Z",
};
const body = {
  project: "gnd",
  name: "Quotes",
  steps: funnel.steps,
  window: "7d",
};

function deps(
  role: string | null = "admin",
  calls: string[] = [],
): FunnelRouteDependencies {
  return {
    getRole: async () => role,
    create: async (input) => {
      calls.push(`create:${input.name}:${input.steps.length}`);
      return { status: "saved", funnel };
    },
    update: async (input) => {
      calls.push(`update:${input.id}`);
      return { status: "saved", funnel };
    },
    remove: async (input) => {
      calls.push(`remove:${input.id}`);
      return true;
    },
  };
}

function request(
  method: string,
  payload?: unknown,
  origin = "https://logly.example",
  query = "",
) {
  return new Request(`https://logly.example/api/funnels${query}`, {
    method,
    headers: { origin, "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

test("an admin creates, updates and deletes a saved funnel", async () => {
  const calls: string[] = [];
  expect(
    (await handleCreateFunnel(request("POST", body), deps("admin", calls)))
      .status,
  ).toBe(201);
  expect(
    (
      await handleUpdateFunnel(
        request("PATCH", { ...body, id }),
        deps("admin", calls),
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await handleDeleteFunnel(
        request("DELETE", undefined, undefined, `?project=gnd&id=${id}`),
        deps("admin", calls),
      )
    ).status,
  ).toBe(200);
  expect(calls).toEqual(["create:Quotes:2", `update:${id}`, `remove:${id}`]);
});

test("refuses non-admins, foreign origins and invalid funnels", async () => {
  const calls: string[] = [];
  expect(
    (await handleCreateFunnel(request("POST", body), deps("user", calls)))
      .status,
  ).toBe(401);
  expect(
    (await handleCreateFunnel(request("POST", body), deps(null, calls))).status,
  ).toBe(401);
  expect(
    (
      await handleUpdateFunnel(
        request("PATCH", { ...body, id }, "https://evil.example"),
        deps("admin", calls),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await handleDeleteFunnel(
        request("DELETE", undefined, undefined, `?project=gnd&id=${id}`),
        deps("user", calls),
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await handleCreateFunnel(
        request("POST", { ...body, steps: [{ event: "only_one" }] }),
        deps("admin", calls),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await handleCreateFunnel(
        request("POST", { ...body, window: "2h" }),
        deps("admin", calls),
      )
    ).status,
  ).toBe(400);
  expect(
    (await handleUpdateFunnel(request("PATCH", body), deps("admin", calls)))
      .status,
  ).toBe(400);
  expect(calls).toEqual([]);
});

test("reports duplicate names and the per-project limit as conflicts", async () => {
  const conflict = (
    status: "duplicate" | "limit",
  ): FunnelRouteDependencies => ({
    ...deps(),
    create: async () => ({ status }),
  });
  expect(
    (await handleCreateFunnel(request("POST", body), conflict("duplicate")))
      .status,
  ).toBe(409);
  expect(
    (await handleCreateFunnel(request("POST", body), conflict("limit"))).status,
  ).toBe(409);
});
