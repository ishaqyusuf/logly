import { auth } from "@logly/auth";
import { createAnalyticsProject } from "@logly/db/queries";
import { headers } from "next/headers";
import { parseCreateProjectInput } from "@/lib/project-input";
import { isTrustedSameOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseCreateProjectInput(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    return Response.json(await createAnalyticsProject(parsed.data), {
      status: 201,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("analytics_projects_slug_idx")) {
      return Response.json(
        { error: "A project with this slug already exists" },
        { status: 409 },
      );
    }
    console.error("Project creation failed", error);
    return Response.json({ error: "Project creation failed" }, { status: 500 });
  }
}
