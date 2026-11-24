import { expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { eventContextConditions, hashEventGroups } from "./event-context";

test("group references are stable, project/type scoped, and preserve label snapshots", () => {
  const groups = {
    business: { key: "private-tenant", properties: { name: "Shop" } },
  };
  const a = hashEventGroups(groups, "secret", "project-a");
  expect(a).toEqual(hashEventGroups(groups, "secret", "project-a"));
  expect(a.business?.key).not.toBe(
    hashEventGroups(groups, "secret", "project-b").business?.key,
  );
  expect(a.business?.key).not.toBe(
    hashEventGroups({ team: groups.business }, "secret", "project-a").team?.key,
  );
  expect(JSON.stringify(a)).not.toContain("private-tenant");
  expect(a.business?.properties?.name).toBe("Shop");
  groups.business.properties.name = "Renamed";
  expect(a.business?.properties?.name).toBe("Shop");
});

test("property and group filtering parameterizes caller strings", () => {
  const fragment = eventContextConditions({
    groupType: "business",
    groupKey: "x' OR true--",
    propertyKey: "field'",
    propertyValue: '"value"',
  });
  if (!fragment) throw new Error("Missing predicate");
  const compiled = new PgDialect().sqlToQuery(fragment);
  expect(compiled.sql).not.toContain("OR true");
  expect(compiled.params).toContain(
    JSON.stringify({ business: { key: "x' OR true--" } }),
  );
  expect(compiled.params).toContain(JSON.stringify({ "field'": "value" }));
});
