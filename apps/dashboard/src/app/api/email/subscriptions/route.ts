import { auth } from "@logly/auth";
import { getEmailProject, setEmailSubscription } from "@logly/db/queries";
import { handleSetSubscription } from "@/lib/email-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin opt-in for one operator, project or organization scope. */
export async function PUT(request: Request) {
  return handleSetSubscription(request, {
    getRole: async () =>
      (await auth.api.getSession({ headers: request.headers }))?.user.role,
    save: async (input) => {
      const project = await getEmailProject(input.project);
      if (!project) return "project_not_found";
      const result = await setEmailSubscription({
        userId: input.userId,
        scope:
          input.scope === "project"
            ? { projectId: project.id }
            : { organizationId: project.organization.id },
        weeklyDigest: input.weeklyDigest,
        trackingAlerts: input.trackingAlerts,
      });
      return result.status;
    },
  });
}
