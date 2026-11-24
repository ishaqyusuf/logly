import { auth } from "@logly/auth";
import { getEmailProject } from "@logly/db/queries";
import { dashboardLink, digestWeek, renderDigestEmail } from "@logly/email";
import { previewResponse } from "@/lib/email-route";
import { buildDigestData, emailBaseUrl } from "@/lib/email-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin preview of last week's digest (`?format=text` for the fallback). */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user.role !== "admin")
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const project = await getEmailProject(params.get("project") ?? "");
  if (!project)
    return Response.json({ error: "Project not found" }, { status: 404 });
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
    unsubscribeUrl: `${baseUrl}/api/email/unsubscribe?token=preview`,
  });
  return previewResponse(email, params.get("format"));
}
