import { afterEach, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { createServerAnalytics } from "./index";
import { releaseFromEnvironment, sendRelease } from "./release";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("releases", () => {
  test("posts a signed release and returns the collector result", async () => {
    let request: Request | undefined;
    globalThis.fetch = (async (input, init) => {
      request = new Request(input, init);
      return Response.json(
        { created: true, release: { version: "abc123" } },
        { status: 201 },
      );
    }) as typeof fetch;

    const result = await createServerAnalytics({
      collectorUrl: "https://collector.logly.test/",
      project: "shop",
      serverKey: "server-secret",
    }).release({
      version: "abc123",
      deployedAt: new Date("2026-11-24T10:00:00Z"),
      description: "Checkout",
    });

    expect(result.created).toBe(true);
    expect(request?.url).toBe("https://collector.logly.test/v1/releases");
    const body = (await request?.text()) ?? "";
    expect(JSON.parse(body)).toEqual({
      project: "shop",
      version: "abc123",
      environment: "production",
      deployedAt: "2026-11-24T10:00:00.000Z",
      description: "Checkout",
    });
    expect(request?.headers.get("x-logly-signature")).toBe(
      createHmac("sha256", "server-secret").update(body).digest("hex"),
    );
  });

  test("surfaces the collector's error message", async () => {
    globalThis.fetch = (async () =>
      Response.json(
        { error: "Invalid signature" },
        { status: 401 },
      )) as unknown as typeof fetch;
    await expect(
      sendRelease(
        { collectorUrl: "https://c.test", project: "p", serverKey: "k" },
        { version: "1.0.0" },
      ),
    ).rejects.toThrow("Logly collector returned 401: Invalid signature");
  });

  test("derives releases from Vercel and GitHub variables", () => {
    expect(
      releaseFromEnvironment({
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_SHA: "0123456789abcdef0123",
        VERCEL_GIT_COMMIT_MESSAGE: "Fix checkout\n\nLong body",
        VERCEL_URL: "shop-git-fix.vercel.app",
      }),
    ).toEqual({
      version: "0123456789ab",
      environment: "preview",
      description: "Fix checkout",
      url: "https://shop-git-fix.vercel.app",
    });
    expect(
      releaseFromEnvironment({
        GITHUB_SHA: "fedcba9876543210",
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "acme/shop",
        LOGLY_RELEASE_VERSION: "v2.0.0",
      }),
    ).toEqual({
      version: "v2.0.0",
      environment: "production",
      url: "https://github.com/acme/shop/commit/fedcba9876543210",
    });
    expect(
      releaseFromEnvironment({ VERCEL_ENV: "development", GITHUB_SHA: "abc" }),
    ).toBeNull();
    expect(releaseFromEnvironment({})).toBeNull();
  });
});
