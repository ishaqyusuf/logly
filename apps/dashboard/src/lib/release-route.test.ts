import { expect, test } from "bun:test";
import {
  handleCreateRelease,
  handleDeleteRelease,
  type ReleaseRouteDependencies,
} from "./release-route";

const release = {
  id: "00000000-0000-4000-8000-000000000001",
  environment: "production" as const,
  version: "v1.0.0",
  deployedAt: "2026-11-24T10:00:00.000Z",
  description: null,
  url: null,
  source: "dashboard" as const,
};

function deps(
  role: string | null = "admin",
  calls: string[] = [],
): ReleaseRouteDependencies {
  return {
    getRole: async () => role,
    record: async (input) => {
      calls.push(`record:${input.source}:${input.version}`);
      return { status: "created", release };
    },
    remove: async ({ id }) => {
      calls.push(`remove:${id}`);
      return true;
    },
  };
}

function post(body: unknown, origin = "https://logly.example") {
  return new Request("https://logly.example/api/releases", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("creates a dashboard release for an admin on the same origin", async () => {
  const calls: string[] = [];
  const response = await handleCreateRelease(
    post({ project: "shop", version: "v1.0.0" }),
    deps("admin", calls),
  );
  expect(response.status).toBe(201);
  expect(calls).toEqual(["record:dashboard:v1.0.0"]);
});

test("refuses foreign origins, non-admins and invalid bodies", async () => {
  const calls: string[] = [];
  expect(
    (
      await handleCreateRelease(
        post({ project: "shop", version: "1" }, "https://evil.example"),
        deps("admin", calls),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await handleCreateRelease(
        post({ project: "shop", version: "1" }),
        deps("user", calls),
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await handleCreateRelease(
        post({ project: "shop", version: "has space" }),
        deps("admin", calls),
      )
    ).status,
  ).toBe(400);
  expect(calls).toEqual([]);
});

test("deletes by project and uuid only", async () => {
  const calls: string[] = [];
  const del = (query: string) =>
    handleDeleteRelease(
      new Request(`https://logly.example/api/releases?${query}`, {
        method: "DELETE",
        headers: { origin: "https://logly.example" },
      }),
      deps("admin", calls),
    );
  expect((await del("project=shop&id=nope")).status).toBe(400);
  expect((await del(`project=shop&id=${release.id}`)).status).toBe(200);
  expect(calls).toEqual([`remove:${release.id}`]);
});
