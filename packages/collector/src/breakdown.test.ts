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

const window = "start=2026-11-01T00:00:00Z&end=2026-11-08T00:00:00Z";

test("breakdown rejects invalid input with a JSON 400", async () => {
  process.env.NODE_ENV = "development";
  delete process.env.LOGLY_READ_KEY;
  const app = createCollectorApp();
  for (const [params, error] of [
    [`${window}&by=name`, "Project is required"],
    [`project=p&${window}`, "by requires one or two dimensions"],
    [`project=p&${window}&by=country`, "Invalid breakdown dimension: country"],
    [
      `project=p&${window}&by=name&metrics=visitors`,
      "Invalid metric: visitors",
    ],
    [
      `project=p&${window}&by=name&limit=50`,
      "limit must be an integer from 1 to 20",
    ],
    [
      `project=p&start=2026-11-01&end=2026-11-08&by=name`,
      "start must be an ISO 8601 timestamp with a time zone",
    ],
  ]) {
    const result = await app.request(`/v1/dashboard/breakdown?${params}`);
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({ error: error as string });
  }
});

test("breakdown requires read authorization before validation", async () => {
  process.env.NODE_ENV = "production";
  process.env.LOGLY_READ_KEY = "test-read-key";
  const result = await createCollectorApp().request(
    `/v1/dashboard/breakdown?${window}&by=country`,
  );
  expect(result.status).toBe(401);
  expect(await result.json()).toEqual({ error: "Unauthorized" });
});
