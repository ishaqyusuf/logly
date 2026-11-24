import { auth } from "@logly/auth";
import { issueAnalyticsProjectKey } from "@logly/db/queries";
import { handleProjectKeyRequest } from "@/lib/project-key-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleProjectKeyRequest(request, {
    getRole: async () =>
      (await auth.api.getSession({ headers: request.headers }))?.user.role,
    issueKey: issueAnalyticsProjectKey,
  });
}
