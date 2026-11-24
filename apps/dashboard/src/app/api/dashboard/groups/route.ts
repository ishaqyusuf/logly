import { auth } from "@logly/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDashboardGroups } from "@/lib/dashboard-data";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const project = params.get("project");
  if (!project || !/^[a-z0-9-]{2,64}$/.test(project))
    return NextResponse.json({ error: "Project is required" }, { status: 400 });
  return NextResponse.json(
    await getDashboardGroups(project, params.get("q")?.slice(0, 128)),
  );
}
