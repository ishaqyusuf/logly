import { describe, expect, test } from "bun:test";
import { createAnalyticsForTesting } from "./client";
import type { AnalyticsBatch } from "./contracts";
import { createMemoryEventStore } from "./event-store";
import { createRouteNormalizer, normalizeRoute } from "./route-template";
import { createMemoryStorage } from "./visitor";

describe("normalizeRoute", () => {
  test.each([
    ["", "/"],
    ["/", "/"],
    ["/orders?tab=bin#top", "/orders"],
    ["/orders/bin", "/orders/bin"],
    ["/orders/123", "/orders/:id"],
    ["/orders/04512AB/edit", "/orders/:id/edit"],
    ["/invoices/abc123def", "/invoices/:id"],
    ["/dispatch/0F8FAD5B-D9CB-469F-A165-70867728950E", "/dispatch/:id"],
    ["/customers/v2", "/customers/v2"],
    ["/job-overview-v2", "/job-overview-v2"],
    ["/settings/two_factor", "/settings/two_factor"],
    ["/files/report%20final", "/files/:id"],
    ["/notes/john@example.com", "/notes/:id"],
    [`/links/${"x".repeat(60)}`, "/links/:id"],
    ["/a/b/c/d/e/f/g/h", "/a/b/c/d/e/f"],
    ["/orders/:id", "/orders/:id"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeRoute(input)).toBe(expected);
  });
});

describe("createRouteNormalizer", () => {
  const normalize = createRouteNormalizer({
    redactPrefixes: ["/checkout", "/sales/accept-quote"],
    idParents: ["projects", "customers"],
    keep: ["2fa"],
    maxSegments: 4,
  });

  test.each([
    ["/checkout/secret-token/v2", "/checkout"],
    ["/Checkout/secret-token", "/Checkout"],
    ["/sales/accept-quote/04512AB", "/sales/accept-quote"],
    ["/sales/orders", "/sales/orders"],
    ["/projects", "/projects"],
    ["/projects/oak-ridge/units", "/projects/:id/units"],
    ["/customers/v2/john-doe", "/customers/v2/:id"],
    ["/settings/2fa", "/settings/2fa"],
    ["/a/b/c/d/e", "/a/b/c/d"],
  ])("%s → %s", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});

describe("browser client route templates", () => {
  const ids = () => {
    let id = 0;
    return () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`;
  };

  const capture = (
    routeTemplates?: Parameters<typeof createRouteNormalizer>[0] | false,
  ) => {
    const batches: AnalyticsBatch[] = [];
    const client = createAnalyticsForTesting(
      {
        project: "logly-dashboard",
        storage: createMemoryStorage(),
        createId: ids(),
        transport: async (batch) => {
          batches.push(batch);
        },
        respectPrivacySignals: false,
        routeTemplates,
      },
      createMemoryEventStore(),
    );
    const routes = async () => {
      await client.flush();
      return batches
        .flatMap((batch) => batch.events)
        .map((event) => event.route);
    };
    return { client, routes };
  };

  test("records page views and events as templates by default", async () => {
    const { client, routes } = capture();
    client.trackPageView({ route: "/orders/123?email=private" });
    client.track("order_opened", {}, { route: "/orders/123" });
    expect(await routes()).toEqual(["/orders/:id", "/orders/:id"]);
    client.destroy();
  });

  test("counts each concrete page once even when they share a template", async () => {
    const { client, routes } = capture();
    expect(client.trackPageView({ route: "/orders/123" })).toBe(true);
    expect(client.trackPageView({ route: "/orders/123" })).toBe(false);
    expect(client.trackPageView({ route: "/orders/456" })).toBe(true);
    expect(await routes()).toEqual(["/orders/:id", "/orders/:id"]);
    client.destroy();
  });

  test("applies project rules", async () => {
    const { client, routes } = capture({ redactPrefixes: ["/checkout"] });
    client.trackPageView({ route: "/checkout/secret-token" });
    expect(await routes()).toEqual(["/checkout"]);
    client.destroy();
  });

  test("records raw pathnames when disabled", async () => {
    const { client, routes } = capture(false);
    client.trackPageView({ route: "/orders/123?email=private" });
    expect(await routes()).toEqual(["/orders/123"]);
    client.destroy();
  });
});
