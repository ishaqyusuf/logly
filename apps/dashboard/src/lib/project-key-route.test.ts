import { expect, test } from "bun:test";
import { handleProjectKeyRequest } from "./project-key-route";

const input = {
  organization: "ewatrade",
  project: "ewatrade-dashboard",
  scope: "client-ingest",
};
function request(body: unknown = input, origin = "https://logly.example") {
  return new Request("https://logly.example/api/project-keys", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("refuses foreign origins before session lookup or issuance", async () => {
  let calls = 0;
  const response = await handleProjectKeyRequest(
    request(input, "https://foreign.example"),
    {
      getRole: async () => {
        calls++;
        return "admin";
      },
      issueKey: async () => {
        calls++;
        return null;
      },
    },
  );
  expect(response.status).toBe(403);
  expect(calls).toBe(0);
});

test("refuses absent and non-admin sessions without issuing a credential", async () => {
  for (const role of [null, "user"]) {
    let issued = false;
    const response = await handleProjectKeyRequest(request(), {
      getRole: async () => role,
      issueKey: async () => {
        issued = true;
        return null;
      },
    });
    expect(response.status).toBe(401);
    expect(issued).toBe(false);
  }
});

test("rejects malformed project scope and unsupported credentials", async () => {
  for (const body of [
    null,
    [],
    { ...input, organization: "" },
    { ...input, project: "other/project" },
    { ...input, scope: "all" },
  ]) {
    let issued = false;
    const response = await handleProjectKeyRequest(request(body), {
      getRole: async () => "admin",
      issueKey: async () => {
        issued = true;
        return null;
      },
    });
    expect(response.status).toBe(400);
    expect(issued).toBe(false);
  }
});

test("does not invent credentials for missing, mismatched or disabled projects", async () => {
  const response = await handleProjectKeyRequest(request(), {
    getRole: async () => "admin",
    issueKey: async () => null,
  });
  expect(response.status).toBe(404);
});

test("returns successful credentials only in a non-cacheable response", async () => {
  let received: unknown;
  const response = await handleProjectKeyRequest(request(), {
    getRole: async () => "admin",
    issueKey: async (value) => {
      received = value;
      return { scope: value.scope, value: "fixture-only" };
    },
  });
  expect(received).toEqual(input);
  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    key: { scope: "client-ingest", value: "fixture-only" },
  });
});

test("does not expose database errors or credentials in failures", async () => {
  const response = await handleProjectKeyRequest(request(), {
    getRole: async () => "admin",
    issueKey: async () => {
      throw new Error("private database error");
    },
  });
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).not.toContain("private database error");
});
