import { auth } from "@logly/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDashboardEventById } from "@/lib/dashboard-data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const project = new URL(request.url).searchParams.get("project");
  if (!project) {
    return NextResponse.json({ error: "Project is required" }, { status: 400 });
  }
  const { eventId } = await params;
  const event = await getDashboardEventById(eventId, project);
  return event
    ? NextResponse.json(event)
    : NextResponse.json({ error: "Event not found" }, { status: 404 });
}
