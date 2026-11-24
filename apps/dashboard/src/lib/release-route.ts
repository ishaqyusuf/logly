import {
  type AnalyticsRelease,
  parseReleaseInput,
  RELEASE_MAX_BODY_BYTES,
  type ReleaseInput,
} from "@logly/utils";
import { isTrustedSameOrigin } from "./request-origin";

type RecordResult =
  | { status: "created" | "existing"; release: AnalyticsRelease }
  | { status: "project_not_found" };

export type ReleaseRouteDependencies = {
  getRole: () => Promise<string | null | undefined>;
  record: (
    input: ReleaseInput & { source: "dashboard" },
  ) => Promise<RecordResult>;
  remove: (input: { project: string; id: string }) => Promise<boolean>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function authorize(
  request: Request,
  dependencies: ReleaseRouteDependencies,
) {
  if (!isTrustedSameOrigin(request))
    return reply({ error: "Invalid request origin" }, 403);
  if ((await dependencies.getRole()) !== "admin")
    return reply({ error: "Unauthorized" }, 401);
  return null;
}

/** Manual deploy marker from the dashboard (admin, same-origin only). */
export async function handleCreateRelease(
  request: Request,
  dependencies: ReleaseRouteDependencies,
) {
  const denied = await authorize(request, dependencies);
  if (denied) return denied;
  const text = await request.text().catch(() => "");
  if (text.length > RELEASE_MAX_BODY_BYTES)
    return reply({ error: "Release body too large" }, 413);
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {}
  const parsed = parseReleaseInput(body);
  if (!parsed.ok) return reply({ error: parsed.error }, 400);
  try {
    const result = await dependencies.record({
      ...parsed.data,
      source: "dashboard",
    });
    if (result.status === "project_not_found")
      return reply({ error: "Project not found" }, 404);
    return reply(
      { created: result.status === "created", release: result.release },
      result.status === "created" ? 201 : 200,
    );
  } catch {
    return reply({ error: "Could not record the release" }, 500);
  }
}

export async function handleDeleteRelease(
  request: Request,
  dependencies: ReleaseRouteDependencies,
) {
  const denied = await authorize(request, dependencies);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const project = params.get("project");
  const id = params.get("id");
  if (!project || !id || !UUID.test(id))
    return reply({ error: "project and id are required" }, 400);
  try {
    return (await dependencies.remove({ project, id }))
      ? reply({ deleted: true }, 200)
      : reply({ error: "Release not found" }, 404);
  } catch {
    return reply({ error: "Could not delete the release" }, 500);
  }
}
