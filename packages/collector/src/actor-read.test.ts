import { afterEach, expect, test } from "bun:test";
import { createCollectorApp } from "./index";

const before = {
  NODE_ENV: process.env.NODE_ENV,
  LOGLY_READ_KEY: process.env.LOGLY_READ_KEY,
};
afterEach(() => {
  for (const key of ["NODE_ENV", "LOGLY_READ_KEY"] as const) {
    const value = before[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
test("invalid actor filters return JSON 400 on both read interfaces", async () => {
  process.env.NODE_ENV = "development";
  delete process.env.LOGLY_READ_KEY;
  const app = createCollectorApp();
  for (const path of ["events", "event-summary"]) {
    const result = await app.request(
      `/v1/dashboard/${path}?actor=raw-account-id`,
    );
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({ error: "Invalid event actor" });
  }
});
test("read authorization precedes actor validation", async () => {
  process.env.NODE_ENV = "production";
  process.env.LOGLY_READ_KEY = "test-read-key";
  const result = await createCollectorApp().request(
    "/v1/dashboard/events?actor=raw-account-id",
  );
  expect(result.status).toBe(401);
  expect(await result.json()).toEqual({ error: "Unauthorized" });
});
