import { auth } from "@logly/auth";
import {
  createSavedFunnel,
  deleteSavedFunnel,
  updateSavedFunnel,
} from "@logly/db/queries";
import {
  type FunnelRouteDependencies,
  handleCreateFunnel,
  handleDeleteFunnel,
  handleUpdateFunnel,
} from "@/lib/funnel-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function dependencies(request: Request): FunnelRouteDependencies {
  return {
    getRole: async () =>
      (await auth.api.getSession({ headers: request.headers }))?.user.role,
    create: (input) => createSavedFunnel(input),
    update: (input) => updateSavedFunnel(input),
    remove: (input) => deleteSavedFunnel(input),
  };
}

export async function POST(request: Request) {
  return handleCreateFunnel(request, dependencies(request));
}

export async function PATCH(request: Request) {
  return handleUpdateFunnel(request, dependencies(request));
}

export async function DELETE(request: Request) {
  return handleDeleteFunnel(request, dependencies(request));
}
