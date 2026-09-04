"use client";

import {
  type AnalyticsClient,
  type AnalyticsConfig,
  createAnalytics,
} from "@ishaqyusuf/logly-core";
import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";

const AnalyticsContext = createContext<AnalyticsClient | null>(null);

export function AnalyticsProvider({
  children,
  autoTrackPageViews = false,
  ...config
}: AnalyticsConfig & { children: ReactNode }) {
  const pathname = usePathname();
  const clientRef = useRef<AnalyticsClient | null>(null);
  if (!clientRef.current)
    clientRef.current = createAnalytics({ ...config, autoTrackPageViews });
  const client = clientRef.current;

  useEffect(() => {
    client.init();
    return () => client.destroy();
  }, [client]);

  useEffect(() => {
    if (autoTrackPageViews && pathname) {
      client.trackPageView({ route: pathname });
    }
  }, [autoTrackPageViews, client, pathname]);

  return (
    <AnalyticsContext.Provider value={client}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const client = useContext(AnalyticsContext);
  if (!client)
    throw new Error("useAnalytics must be used inside AnalyticsProvider");
  return client;
}

export function useTrack() {
  return useAnalytics().track;
}
