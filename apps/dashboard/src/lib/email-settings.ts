import { getEmailProject, listEmailSubscriptions } from "@logly/db/queries";
import { emailTransport } from "./email-service";

/** Props for the admin Email section in Settings; null when unavailable. */
export async function getEmailSettings(projectSlug: string) {
  try {
    const project = await getEmailProject(projectSlug);
    if (!project) return null;
    const operators = await listEmailSubscriptions({
      id: project.id,
      organizationId: project.organization.id,
    });
    const transport = emailTransport();
    return {
      project: project.slug,
      projectName: project.name,
      organizationName: project.organization.name,
      operators: operators.map((operator) => ({
        userId: operator.userId,
        name: operator.name,
        email: operator.email,
        project: operator.project,
        organization: operator.organization,
      })),
      delivery: { enabled: transport.enabled, reason: transport.reason },
    };
  } catch (error) {
    // Email settings are supplementary; never fail the page over them.
    console.error("Email settings failed to load", error);
    return null;
  }
}
