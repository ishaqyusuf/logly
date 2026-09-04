"use client";

import { AnalyticsProvider } from "@ishaqyusuf/logly-next";
import type { ReactNode } from "react";

export function LoglyAnalyticsProvider({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProvider
      project={process.env.NEXT_PUBLIC_LOGLY_PROJECT ?? "logly-dashboard"}
      endpoint={process.env.NEXT_PUBLIC_LOGLY_ENDPOINT ?? "/api/analytics"}
      autoTrackPageViews
      trackAttributes
      permission={() => "allowed"}
      disabled={process.env.NODE_ENV !== "production"}
    >
      {children}
    </AnalyticsProvider>
  );
}
