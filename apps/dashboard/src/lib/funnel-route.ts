import {
  FUNNEL_MAX_BODY_BYTES,
  FUNNEL_MAX_SAVED_PER_PROJECT,
  parseSavedFunnelInput,
  type SavedFunnel,
  type SavedFunnelInput,
} from "@logly/utils";
import { isTrustedSameOrigin } from "./request-origin";

type SaveResult =
  | { status: "saved"; funnel: SavedFunnel }
  | { status: "project_not_found" | "not_found" | "duplicate" | "limit" };

export type FunnelRouteDependencies = {
  getRole: () => Promise<string | null | undefined>;
  create: (input: SavedFunnelInput) => Promise<SaveResult>;
  update: (input: SavedFunnelInput & { id: string }) => Promise<SaveResult>;
  remove: (input: { project: string; id: string }) => Promise<boolean>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Saved-funnel writes need an admin session on a same-origin request. */
async function authorize(
  request: Request,
  dependencies: FunnelRouteDependencies,
) {
  if (!isTrustedSameOrigin(request))
    return reply({ error: "Invalid request origin" }, 403);
  if ((await dependencies.getRole()) !== "admin")
    return reply({ error: "Unauthorized" }, 401);
  return null;
}

async function readBody(request: Request) {
  const text = await request.text().catch(() => "");
  if (text.length > FUNNEL_MAX_BODY_BYTES) return { tooLarge: true as const };
  try {
    return { body: JSON.parse(text) as unknown };
  } catch {
    return { body: null };
  }
}

function saved(result: SaveResult, created: boolean) {
  switch (result.status) {
    case "saved":
      return reply({ funnel: result.funnel }, created ? 201 : 200);
    case "project_not_found":
      return reply({ error: "Project not found" }, 404);
    case "not_found":
      return reply({ error: "Funnel not found" }, 404);
    case "duplicate":
      return reply({ error: "A funnel with this name already exists" }, 409);
    case "limit":
      return reply(
        {
          error: `A project can keep at most ${FUNNEL_MAX_SAVED_PER_PROJECT} saved funnels`,
        },
        409,
      );
  }
}

export async function handleCreateFunnel(
  request: Request,
  dependencies: FunnelRouteDependencies,
) {
  const denied = await authorize(request, dependencies);
  if (denied) return denied;
  const read = await readBody(request);
  if ("tooLarge" in read) return reply({ error: "Funnel body too large" }, 413);
  const parsed = parseSavedFunnelInput(read.body);
  if (!parsed.ok) return reply({ error: parsed.error }, 400);
  try {
    return saved(await dependencies.create(parsed.data), true);
  } catch {
    return reply({ error: "Could not save the funnel" }, 500);
  }
}

export async function handleUpdateFunnel(
  request: Request,
  dependencies: FunnelRouteDependencies,
) {
  const denied = await authorize(request, dependencies);
  if (denied) return denied;
  const read = await readBody(request);
  if ("tooLarge" in read) return reply({ error: "Funnel body too large" }, 413);
  const id = (read.body as { id?: unknown } | null)?.id;
  if (typeof id !== "string" || !UUID.test(id))
    return reply({ error: "A funnel id is required" }, 400);
  const parsed = parseSavedFunnelInput(read.body);
  if (!parsed.ok) return reply({ error: parsed.error }, 400);
  try {
    return saved(await dependencies.update({ ...parsed.data, id }), false);
  } catch {
    return reply({ error: "Could not save the funnel" }, 500);
  }
}

export async function handleDeleteFunnel(
  request: Request,
  dependencies: FunnelRouteDependencies,
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
      : reply({ error: "Funnel not found" }, 404);
  } catch {
    return reply({ error: "Could not delete the funnel" }, 500);
  }
}
