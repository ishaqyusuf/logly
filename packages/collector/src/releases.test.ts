import { afterEach, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { groupReleasesByBucket, parseReleaseInput } from "@logly/utils";
import { createCollectorApp } from "./index";

const before = {
  LOGLY_SERVER_KEY: process.env.LOGLY_SERVER_KEY,
  LOGLY_DATABASE_URL: process.env.LOGLY_DATABASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
};
afterEach(() => {
  for (const [key, value] of Object.entries(before)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const now = new Date("2026-11-24T12:00:00Z");
const sign = (body: string, key: string) =>
  createHmac("sha256", key).update(body).digest("hex");

function post(body: string, headers: Record<string, string> = {}) {
  return createCollectorApp().request("/v1/releases", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

test("parseReleaseInput applies defaults and bounds", () => {
  const ok = parseReleaseInput({ project: "shop", version: "abc1234" }, now);
  expect(ok).toEqual({
    ok: true,
    data: {
      project: "shop",
      version: "abc1234",
      environment: "production",
      deployedAt: now,
      description: null,
      url: null,
    },
  });
  const invalid: Array<[Record<string, unknown>, string]> = [
    [{ version: "1" }, "project is required"],
    [{ project: "p", version: "has space" }, "version"],
    [{ project: "p", version: "x".repeat(101) }, "version"],
    [{ project: "p", version: "1", environment: "staging" }, "environment"],
    [{ project: "p", version: "1", deployedAt: "soon" }, "deployedAt"],
    [
      { project: "p", version: "1", deployedAt: "2026-11-24T13:00:00Z" },
      "future",
    ],
    [
      { project: "p", version: "1", deployedAt: "2024-01-01T00:00:00Z" },
      "365 days",
    ],
    [
      { project: "p", version: "1", description: "d".repeat(281) },
      "description",
    ],
    [{ project: "p", version: "1", url: "javascript:alert(1)" }, "url"],
  ];
  for (const [body, error] of invalid) {
    const result = parseReleaseInput(body, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(error);
  }
});

test("groupReleasesByBucket maps releases onto chart buckets", () => {
  const releases = [
    { id: "b", deployedAt: "2026-11-24T10:45:00.000Z" },
    { id: "a", deployedAt: "2026-11-24T10:05:00.000Z" },
    { id: "out", deployedAt: "2026-11-20T10:00:00.000Z" },
  ];
  const hourly = groupReleasesByBucket(
    releases,
    ["2026-11-24T10:00:00Z", "2026-11-24T11:00:00Z"],
    "hour",
  );
  expect([...hourly.keys()]).toEqual(["2026-11-24T10:00:00Z"]);
  expect(hourly.get("2026-11-24T10:00:00Z")?.map((r) => r.id)).toEqual([
    "a",
    "b",
  ]);
  const daily = groupReleasesByBucket(releases, ["2026-11-24"], "day");
  expect(daily.get("2026-11-24")).toHaveLength(2);
});

test("POST /v1/releases rejects oversized, invalid and unauthenticated bodies", async () => {
  delete process.env.LOGLY_DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.LOGLY_SERVER_KEY = "global-server-key";

  const large = JSON.stringify({
    project: "p",
    version: "1",
    description: "x".repeat(5000),
  });
  expect((await post(large)).status).toBe(413);
  expect((await post("not json")).status).toBe(400);

  const body = JSON.stringify({ project: "shop", version: "1.0.0" });
  expect((await post(body)).status).toBe(401);
  expect((await post(body, { authorization: "Bearer wrong-key" })).status).toBe(
    401,
  );
  const badSignature = await post(body, {
    authorization: "Bearer global-server-key",
    "x-logly-signature": sign(body, "other-key"),
  });
  expect(badSignature.status).toBe(401);
  expect(await badSignature.json()).toEqual({ error: "Invalid signature" });

  // Authenticated and signed: without a database it fails closed.
  const signed = await post(body, {
    authorization: "Bearer global-server-key",
    "x-logly-signature": sign(body, "global-server-key"),
  });
  expect(signed.status).toBe(503);
});

test("GET /v1/dashboard/releases validates its query", async () => {
  const app = createCollectorApp();
  expect((await app.request("/v1/dashboard/releases")).status).toBe(400);
  expect(
    (await app.request("/v1/dashboard/releases?project=p&start=nope")).status,
  ).toBe(400);
  expect(
    (await app.request("/v1/dashboard/releases?project=p&environment=qa"))
      .status,
  ).toBe(400);
});
