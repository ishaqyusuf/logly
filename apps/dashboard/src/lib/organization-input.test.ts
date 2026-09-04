import { describe, expect, test } from "bun:test";
import { parseCreateOrganizationInput } from "./organization-input";

describe("organization input", () => {
  test("generates the slug from the organization name", () => {
    expect(parseCreateOrganizationInput({ name: "Ishaq Labs" })).toEqual({
      success: true,
      data: { name: "Ishaq Labs", slug: "ishaq-labs" },
    });
  });

  test("rejects names that cannot produce a safe slug", () => {
    expect(parseCreateOrganizationInput({ name: "项目" }).success).toBe(false);
  });
});
