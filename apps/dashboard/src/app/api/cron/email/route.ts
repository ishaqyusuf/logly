import { runEmailJob } from "@logly/email";
import { handleEmailCron } from "@/lib/email-route";
import {
  emailBaseUrl,
  emailJobStore,
  emailTransport,
  emailUnsubscribeKey,
} from "@/lib/email-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// The job stops claiming new sends after 45s (EMAIL_JOB_BUDGET_MS).
export const maxDuration = 60;

/**
 * Daily Vercel cron (`vercel.json`, 07:00 UTC): evaluates tracking alerts,
 * emails alert transitions, and sends last week's digests. Safe to overlap
 * or repeat; every send is claimed in `analytics_email_sends` first.
 */
export async function GET(request: Request) {
  return handleEmailCron(request, {
    cronSecret: process.env.CRON_SECRET,
    run: async () => {
      const baseUrl = emailBaseUrl();
      const key = emailUnsubscribeKey();
      const transport = emailTransport();
      if (!baseUrl || !key)
        throw new Error(
          "NEXT_PUBLIC_DASHBOARD_URL/BETTER_AUTH_URL and BETTER_AUTH_SECRET are required",
        );
      return runEmailJob({
        store: emailJobStore,
        transport,
        baseUrl,
        unsubscribeKey: key,
      });
    },
  });
}
