import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { LoglyAnalyticsProvider } from "@/components/analytics-provider";
import { ClientProviders } from "@/components/client-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Logly", template: "%s · Logly" },
  description: "Small, first-party analytics for your products.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NuqsAdapter>
          <ClientProviders>
            <LoglyAnalyticsProvider>{children}</LoglyAnalyticsProvider>
          </ClientProviders>
        </NuqsAdapter>
      </body>
    </html>
  );
}
