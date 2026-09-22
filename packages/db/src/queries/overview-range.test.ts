import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { drizzle } from "drizzle-orm/pg-proxy";
import * as databaseClient from "../client";
import * as schema from "../schema";
import { getDashboardData } from "./index";

afterEach(() => mock.restore());

describe("overview date query serialization", () => {
  test.each([
    "24h",
    "7d",
    "30d",
  ] as const)("%s serializes the previous window and keeps its upper bound exclusive", async (range) => {
    const queries: { sql: string; params: unknown[] }[] = [];
    const db = drizzle(
      async (sql, params) => {
        queries.push({ sql, params });
        // postgres-js cannot encode an untyped Date in a raw SQL parameter.
        if (params.some((value) => value instanceof Date)) {
          throw new TypeError("Unserialized Date reached the database driver");
        }
        return { rows: [] };
      },
      { schema },
    );
    // Substitute only the transport; retain Drizzle's real query encoders.
    spyOn(databaseClient, "getDatabase").mockReturnValue(
      db as unknown as databaseClient.Database,
    );

    const result = await getDashboardData("test-project", "test-org", range);
    const previous = queries.find(({ sql }) =>
      sql.includes('"analytics_events"."occurred_at" < '),
    );
    expect(result.mode).toBe("database");
    expect(previous).toBeDefined();
    expect(previous?.params.slice(0, 2)).toEqual(["test-project", "test-org"]);
    const dates = previous?.params.slice(-2);
    expect(dates?.every((value) => typeof value === "string")).toBe(true);
    const hours = range === "24h" ? 24 : range === "7d" ? 168 : 720;
    expect(
      Date.parse(String(dates?.[1])) - Date.parse(String(dates?.[0])),
    ).toBe(hours * 3_600_000);
  });
});
