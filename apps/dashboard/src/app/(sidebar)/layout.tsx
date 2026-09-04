import { auth } from "@logly/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Header } from "@/components/header";
import { GlobalSheetsProvider } from "@/components/sheets/global-sheets-provider";
import { Sidebar } from "@/components/sidebar";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function SidebarLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const data = await getDashboardData();
  return (
    <div className="min-h-screen">
      <Sidebar
        organizations={data.organizations}
        projects={data.projects}
        user={session.user}
      />
      <div className="md:ml-[84px]">
        <Header mode={data.mode} projects={data.projects} user={session.user} />
        {children}
      </div>
      <GlobalSheetsProvider
        organizations={data.organizations}
        projects={data.projects}
        mode={data.mode}
      />
    </div>
  );
}
