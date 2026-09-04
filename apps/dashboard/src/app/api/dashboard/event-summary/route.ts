import { auth } from "@logly/auth";
import type { AnalyticsEventQuery } from "@logly/utils";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDashboardEventSummary } from "@/lib/dashboard-data";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const project = params.get("project") ?? undefined;
  if (!project) {
    return NextResponse.json({ error: "Project is required" }, { status: 400 });
  }
  const split = (key: string) => params.get(key)?.split(",").filter(Boolean);
  const sources = split("sources")?.filter(
    (source): source is "browser" | "server" =>
      source === "browser" || source === "server",
  );
  const query: AnalyticsEventQuery = {
    organization: params.get("organization") ?? undefined,
    project,
    names: split("names"),
    sources,
    q: params.get("q") ?? undefined,
    start: params.get("start") ?? undefined,
    end: params.get("end") ?? undefined,
  };
  return NextResponse.json(await getDashboardEventSummary(query));
}
