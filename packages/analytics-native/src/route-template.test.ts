import { expect, test } from "bun:test";
import type { AnalyticsBatch } from "@ishaqyusuf/logly-core";
import { createNativeAnalytics, sanitizeNativeRoute } from "./index";

test("uses the shared route templates by default", () => {
  expect(sanitizeNativeRoute("/orders/04512AB/delivery?x=1")).toBe(
    "/orders/:id/delivery",
  );
});

test("applies project route template rules", async () => {
  const values = new Map<string, string>();
  const batches: AnalyticsBatch[] = [];
  let id = 0;
  const client = createNativeAnalytics({
    project: "native-app",
    endpoint: "https://collector.test/v1/events",
    platform: "ios",
    storage: {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => void values.set(key, value),
      removeItem: async (key) => void values.delete(key),
    },
    createId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
    send: async (batch) => void batches.push(batch),
    routeTemplates: { idParents: ["projects"] },
  });
  await client.init();
  await client.trackScreenView("/projects/oak-ridge");
  await client.flush();
  expect(
    batches.flatMap((batch) => batch.events).map((event) => event.route),
  ).toContain("/projects/:id");
  await client.destroy();
});
