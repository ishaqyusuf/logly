import { auth } from "@logly/auth";
import { type AnalyticsEventQuery, readContextFilters } from "@logly/utils";
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
    (source): source is "browser" | "server" | "mobile" =>
      source === "browser" || source === "server" || source === "mobile",
  );
  const platforms = split("platforms")?.filter(
    (platform): platform is "web" | "ios" | "android" =>
      platform === "web" || platform === "ios" || platform === "android",
  );
  let contextFilters: ReturnType<typeof readContextFilters>;
  try {
    contextFilters = readContextFilters(params);
  } catch {
    return NextResponse.json(
      { error: "Invalid event context filter" },
      { status: 400 },
    );
  }
  const query: AnalyticsEventQuery = {
    ...contextFilters,
    organization: params.get("organization") ?? undefined,
    project,
    names: split("names"),
    sources,
    platforms,
    q: params.get("q") ?? undefined,
    start: params.get("start") ?? undefined,
    end: params.get("end") ?? undefined,
  };
  return NextResponse.json(await getDashboardEventSummary(query));
}
