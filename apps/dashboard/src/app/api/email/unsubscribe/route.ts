import { unsubscribeEmail } from "@logly/db/queries";
import { verifyUnsubscribeToken } from "@logly/email";
import { handleUnsubscribe } from "@/lib/email-route";
import { emailUnsubscribeKey } from "@/lib/email-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public: the signed token is the only credential. */
function handle(request: Request) {
  const key = emailUnsubscribeKey();
  return handleUnsubscribe(request, {
    verify: (token) => (key ? verifyUnsubscribeToken(key, token) : null),
    unsubscribe: (claim) => unsubscribeEmail(claim),
  });
}

export const GET = handle;
export const POST = handle;
