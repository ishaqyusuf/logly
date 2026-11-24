import { auth } from "@logly/auth";
import { saveEventCatalogMetadata } from "@logly/db/queries";
import { handleSaveEventCatalog } from "@/lib/event-catalog-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin-only, same-origin upsert of one event's catalog metadata. */
export async function PUT(request: Request) {
  return handleSaveEventCatalog(request, {
    getRole: async () =>
      (await auth.api.getSession({ headers: request.headers }))?.user.role,
    save: (input) => saveEventCatalogMetadata(input),
  });
}
