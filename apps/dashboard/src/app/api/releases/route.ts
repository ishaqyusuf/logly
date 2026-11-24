import { auth } from "@logly/auth";
import { deleteRelease, recordRelease } from "@logly/db/queries";
import { isReleaseEnvironment } from "@logly/utils";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getReleases } from "@/lib/dashboard-data";
import {
  handleCreateRelease,
  handleDeleteRelease,
  type ReleaseRouteDependencies,
} from "@/lib/release-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function dependencies(request: Request): ReleaseRouteDependencies {
  return {
    getRole: async () =>
      (await auth.api.getSession({ headers: request.headers }))?.user.role,
    record: (input) => recordRelease(input),
    remove: (input) => deleteRelease(input),
  };
}

/** Releases for one project and window, for client-rendered charts. */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const project = params.get("project");
  if (!project) {
    return NextResponse.json({ error: "Project is required" }, { status: 400 });
  }
  const environment = params.get("environment");
  return NextResponse.json({
    data: await getReleases({
      project,
      start: params.get("start") ?? undefined,
      end: params.get("end") ?? undefined,
      environment: isReleaseEnvironment(environment) ? environment : undefined,
    }),
  });
}

export async function POST(request: Request) {
  return handleCreateRelease(request, dependencies(request));
}

export async function DELETE(request: Request) {
  return handleDeleteRelease(request, dependencies(request));
}
