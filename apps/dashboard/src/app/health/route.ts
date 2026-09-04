import { collectorApp } from "@logly/collector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return collectorApp.fetch(request);
}
