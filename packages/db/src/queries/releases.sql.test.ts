// SQL fixture tests for deploy markers. Runs only against a disposable local
// PostgreSQL database (host local, name ending in "_test") named by
// LOGLY_SQL_TEST_DATABASE_URL; applies every migration into a fresh schema.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";
import { deleteRelease, listReleases, recordRelease } from "./releases";

const url =
  process.env.LOGLY_SQL_TEST_DATABASE_URL ??
  process.env.LOGLY_BREAKDOWN_TEST_DATABASE_URL;
const target = url ? new URL(url) : null;
const runnable = Boolean(
  target &&
    ["127.0.0.1", "localhost"].includes(target.hostname) &&
    target.pathname.endsWith("_test"),
);
const schemaName = `releases_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
let client: ReturnType<typeof postgres> | undefined;
let db: ReturnType<typeof drizzle<typeof schema>>;

const release = (
  project: string,
  version: string,
  deployedAt: string,
  extra: { environment?: "production" | "preview"; description?: string } = {},
) => ({
  project,
  version,
  environment: extra.environment ?? ("production" as const),
  deployedAt: new Date(deployedAt),
  description: extra.description ?? null,
  url: null,
  source: "api" as const,
});

describe.skipIf(!runnable)("releases SQL", () => {
  beforeAll(async () => {
    client = postgres(url ?? "", {
      max: 1,
      prepare: false,
      onnotice: () => {},
      connection: { search_path: schemaName },
    });
    db = drizzle(client, { schema });
    await client.unsafe(`create schema "${schemaName}"`);
    const dir = join(import.meta.dir, "../../drizzle");
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const text = readFileSync(join(dir, file), "utf8").replaceAll(
        '"public".',
        `"${schemaName}".`,
      );
      for (const statement of text.split("--> statement-breakpoint"))
        if (statement.trim()) await client.unsafe(statement);
    }
    const [org] =
      await client`insert into analytics_organizations (slug, name) values ('rel-org', 'Rel') returning id`;
    for (const [slug, enabled] of [
      ["rel-web", true],
      ["rel-other", true],
      ["rel-off", false],
    ] as const) {
      await client`insert into analytics_projects (organization_id, slug, name, enabled) values (${org?.id}, ${slug}, ${slug}, ${enabled})`;
    }
  });

  afterAll(async () => {
    if (client) {
      await client.unsafe(`drop schema if exists "${schemaName}" cascade`);
      await client.end();
    }
  });

  test("records once per project, environment and version", async () => {
    const first = await recordRelease(
      release("rel-web", "v1.0.0", "2026-11-24T10:00:00Z", {
        description: "First",
      }),
      db,
    );
    expect(first.status).toBe("created");
    const retry = await recordRelease(
      release("rel-web", "v1.0.0", "2026-11-24T11:00:00Z", {
        description: "Retry",
      }),
      db,
    );
    expect(retry.status).toBe("existing");
    if (
      first.status !== "project_not_found" &&
      retry.status !== "project_not_found"
    ) {
      expect(retry.release).toEqual(first.release);
      expect(first.release.deployedAt).toBe("2026-11-24T10:00:00.000Z");
    }
    const preview = await recordRelease(
      release("rel-web", "v1.0.0", "2026-11-24T09:00:00Z", {
        environment: "preview",
      }),
      db,
    );
    expect(preview.status).toBe("created");
    expect(
      (
        await recordRelease(
          release("rel-off", "v1", "2026-11-24T09:00:00Z"),
          db,
        )
      ).status,
    ).toBe("project_not_found");
    expect(
      (
        await recordRelease(
          release("missing", "v1", "2026-11-24T09:00:00Z"),
          db,
        )
      ).status,
    ).toBe("project_not_found");
  });

  test("lists one project's releases newest first within a window", async () => {
    await recordRelease(
      release("rel-web", "v0.9.0", "2026-11-20T10:00:00Z"),
      db,
    );
    await recordRelease(release("rel-other", "x1", "2026-11-24T10:00:00Z"), db);
    const all = await listReleases({ project: "rel-web" }, db);
    expect(all.map((r) => `${r.environment}:${r.version}`)).toEqual([
      "production:v1.0.0",
      "preview:v1.0.0",
      "production:v0.9.0",
    ]);
    const windowed = await listReleases(
      {
        project: "rel-web",
        start: new Date("2026-11-21T00:00:00Z"),
        end: new Date("2026-11-25T00:00:00Z"),
        environment: "production",
      },
      db,
    );
    expect(windowed.map((r) => r.version)).toEqual(["v1.0.0"]);
    expect(
      await listReleases({ project: "rel-web", limit: 1 }, db),
    ).toHaveLength(1);
  });

  test("deletes only within the given project", async () => {
    const [other] = await listReleases({ project: "rel-other" }, db);
    expect(
      await deleteRelease({ project: "rel-web", id: other?.id ?? "" }, db),
    ).toBe(false);
    expect(
      await deleteRelease({ project: "rel-other", id: other?.id ?? "" }, db),
    ).toBe(true);
    expect(await listReleases({ project: "rel-other" }, db)).toHaveLength(0);
  });
});
