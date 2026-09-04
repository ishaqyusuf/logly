import { createAnalyticsRoute } from "@ishaqyusuf/logly-next";

export const POST = createAnalyticsRoute({
  collectorUrl: process.env.NEXT_PUBLIC_API_URL,
  projectKey:
    process.env.LOGLY_PROJECT_KEY ??
    (process.env.NODE_ENV === "production" ? undefined : "logly_demo_public"),
  serverKey: process.env.LOGLY_SERVER_KEY,
});
