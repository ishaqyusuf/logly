import {
  EVENT_CATALOG_MAX_BODY_BYTES,
  EVENT_CATALOG_MAX_METADATA,
  type EventCatalogInput,
  type EventCatalogMetadata,
  parseEventCatalogInput,
} from "@logly/utils";
import { isTrustedSameOrigin } from "./request-origin";

type SaveResult =
  | { status: "saved"; metadata: EventCatalogMetadata }
  | { status: "project_not_found" | "limit" };

export type EventCatalogRouteDependencies = {
  getRole: () => Promise<string | null | undefined>;
  save: (input: EventCatalogInput) => Promise<SaveResult>;
};

function reply(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Saves one event's catalog metadata (description, owner/notes, deprecated,
 * hidden). Same authorization as deploy markers and saved funnels: an admin
 * session on a same-origin request.
 */
export async function handleSaveEventCatalog(
  request: Request,
  dependencies: EventCatalogRouteDependencies,
) {
  if (!isTrustedSameOrigin(request))
    return reply({ error: "Invalid request origin" }, 403);
  if ((await dependencies.getRole()) !== "admin")
    return reply({ error: "Unauthorized" }, 401);
  const text = await request.text().catch(() => "");
  if (text.length > EVENT_CATALOG_MAX_BODY_BYTES)
    return reply({ error: "Event metadata body too large" }, 413);
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {}
  const parsed = parseEventCatalogInput(body);
  if (!parsed.ok) return reply({ error: parsed.error }, 400);
  try {
    const result = await dependencies.save(parsed.data);
    switch (result.status) {
      case "saved":
        return reply({ metadata: result.metadata }, 200);
      case "project_not_found":
        return reply({ error: "Project not found" }, 404);
      case "limit":
        return reply(
          {
            error: `A project can keep metadata for at most ${EVENT_CATALOG_MAX_METADATA} events`,
          },
          409,
        );
    }
  } catch {
    return reply({ error: "Could not save the event metadata" }, 500);
  }
}
