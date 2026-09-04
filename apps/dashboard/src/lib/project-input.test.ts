import { describe, expect, test } from "bun:test";
import { parseCreateProjectInput } from "./project-input";

describe("project input", () => {
  test("normalizes and de-duplicates production origins", () => {
    expect(
      parseCreateProjectInput({
        name: "Afterservice",
        allowedOrigins:
          "https://www.afterservice.app/pricing,\nhttps://dashboard.afterservice.app https://www.afterservice.app",
      }),
    ).toEqual({
      success: true,
      data: {
        name: "Afterservice",
        slug: "afterservice",
        allowedOrigins: [
          "https://www.afterservice.app",
          "https://dashboard.afterservice.app",
        ],
        eventCatalog: [],
      },
    });
  });

  test("continues to accept the singular origin payload", () => {
    expect(
      parseCreateProjectInput({
        name: "Afterservice",
        slug: "afterservice",
        allowedOrigin: "https://afterservice.app/pricing",
      }),
    ).toEqual({
      success: true,
      data: {
        name: "Afterservice",
        slug: "afterservice",
        allowedOrigins: ["https://afterservice.app"],
        eventCatalog: [],
      },
    });
  });

  test("generates a deterministic slug from the project name", () => {
    expect(
      parseCreateProjectInput({
        name: "My New SaaS!",
        allowedOrigins: "https://saas.example.com",
      }),
    ).toEqual({
      success: true,
      data: {
        name: "My New SaaS!",
        slug: "my-new-saas",
        allowedOrigins: ["https://saas.example.com"],
        eventCatalog: [],
      },
    });
  });

  test("rejects malformed slugs and origins", () => {
    expect(
      parseCreateProjectInput({
        name: "Afterservice",
        slug: "After Service",
        allowedOrigin: "https://afterservice.app",
      }).success,
    ).toBe(false);
    expect(
      parseCreateProjectInput({
        name: "项目",
        allowedOrigin: "https://afterservice.app",
      }).success,
    ).toBe(false);
    expect(
      parseCreateProjectInput({
        name: "Afterservice",
        slug: "afterservice",
        allowedOrigin: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});
