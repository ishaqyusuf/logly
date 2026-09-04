import { collectorApp } from "@logly/collector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function handle(request: Request) {
  return collectorApp.fetch(request);
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
