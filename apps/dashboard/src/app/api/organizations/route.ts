import { auth } from "@logly/auth";
import { createAnalyticsOrganization } from "@logly/db/queries";
import { headers } from "next/headers";
import { parseCreateOrganizationInput } from "@/lib/organization-input";
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

  const parsed = parseCreateOrganizationInput(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    return Response.json(await createAnalyticsOrganization(parsed.data), {
      status: 201,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("analytics_organizations_slug_idx")) {
      return Response.json(
        { error: "An organization with this name already exists" },
        { status: 409 },
      );
    }
    console.error("Organization creation failed", error);
    return Response.json(
      { error: "Organization creation failed" },
      { status: 500 },
    );
  }
}
