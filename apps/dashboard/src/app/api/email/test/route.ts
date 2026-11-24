import { auth } from "@logly/auth";
import { getEmailProject } from "@logly/db/queries";
import { dashboardLink, digestWeek, renderDigestEmail } from "@logly/email";
import { handleTestDigest } from "@/lib/email-route";
import {
  buildDigestData,
  emailBaseUrl,
  emailTransport,
} from "@/lib/email-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * "Send test digest to me": last week's digest for one project, sent only to
 * the signed-in admin. Not recorded as a send, so it never blocks the real
 * digest. Refused outside production (the transport is disabled there).
 */
export async function POST(request: Request) {
  const transport = emailTransport();
  return handleTestDigest(request, {
    getSessionUser: async () =>
      (await auth.api.getSession({ headers: request.headers }))?.user ?? null,
    transportEnabled: transport.enabled,
    transportReason: transport.reason,
    send: async ({ project: slug, to }) => {
      const project = await getEmailProject(slug);
      if (!project) return "project_not_found";
      const baseUrl = emailBaseUrl() ?? new URL(request.url).origin;
      const data = await buildDigestData(
        project,
        digestWeek(new Date(), project.timeZone),
      );
      const email = renderDigestEmail(data, {
        dashboardUrl: dashboardLink(baseUrl, "/overview", {
          organization: project.organization.slug,
          project: project.slug,
        }),
        unsubscribeUrl: null,
      });
      const result = await transport.send({
        to,
        ...email,
        subject: `[Test] ${email.subject}`,
      });
      return result.status === "sent" ? "sent" : "failed";
    },
  });
}
