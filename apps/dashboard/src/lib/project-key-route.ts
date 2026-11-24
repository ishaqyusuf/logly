import type { IssueProjectKeyInput } from "@logly/db/queries";
import { parseProjectKeyInput } from "./project-key-input";
import { isTrustedSameOrigin } from "./request-origin";

type Dependencies = {
  getRole: () => Promise<string | null | undefined>;
  issueKey: (
    input: IssueProjectKeyInput,
  ) => Promise<{ scope: string; value: string } | null>;
};

export async function handleProjectKeyRequest(
  request: Request,
  dependencies: Dependencies,
) {
  const reply = (body: unknown, status: number) =>
    Response.json(body, {
      status,
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  if (!isTrustedSameOrigin(request))
    return reply({ error: "Invalid request origin" }, 403);
  try {
    if ((await dependencies.getRole()) !== "admin")
      return reply({ error: "Unauthorized" }, 401);
    const input = parseProjectKeyInput(await request.json().catch(() => null));
    if (!input) return reply({ error: "Invalid project key request" }, 400);
    const key = await dependencies.issueKey(input);
    if (!key) return reply({ error: "Project not found or disabled" }, 404);
    return reply({ key }, 201);
  } catch {
    return reply({ error: "Could not issue a project key" }, 500);
  }
}
