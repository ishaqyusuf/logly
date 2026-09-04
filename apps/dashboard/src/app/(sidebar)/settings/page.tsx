import { Badge } from "@logly/ui/badge";
import { Input } from "@logly/ui/input";
import {
  Database,
  Fingerprint,
  Globe2,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { OpenProjectSheet } from "@/components/open-project-sheet";
import { ScrollableContent } from "@/components/scrollable-content";
import { loadProjectWorkspace } from "@/lib/project-workspace-server";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const workspace = await loadProjectWorkspace({
    pathname: "/settings",
    searchParams: params,
    allowEmpty: true,
  });
  if (!workspace.project) {
    return (
      <ScrollableContent>
        <div className="mx-auto grid min-h-[65vh] max-w-2xl place-items-center text-center">
          <div>
            <div className="mx-auto grid size-12 place-items-center rounded-xl bg-[#edf3ee] text-[#347b56]">
              <Globe2 className="size-5" />
            </div>
            <h2 className="mt-5 text-xl font-semibold">
              Connect your first project
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Projects are isolated analytics workspaces. Add an origin to start
              receiving events.
            </p>
            <div className="mt-5">
              <OpenProjectSheet />
            </div>
          </div>
        </div>
      </ScrollableContent>
    );
  }
  const project = workspace.project;
  return (
    <ScrollableContent>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Project settings
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
            {project.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configuration and privacy boundaries for this workspace.
          </p>
        </div>
        <section className="rounded-xl border bg-white shadow-soft">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h3 className="text-sm font-semibold">Project identity</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                The slug is generated from the project name.
              </p>
            </div>
            <Badge
              variant={project.status === "healthy" ? "success" : "warning"}
            >
              {project.status}
            </Badge>
          </div>
          <div className="space-y-5 p-5">
            <SettingField
              icon={Globe2}
              label="Project name"
              description="Shown throughout the selected workspace."
            >
              <Input value={project.name} readOnly />
            </SettingField>
            <SettingField
              icon={KeyRound}
              label="Generated slug"
              description="Used by SDK credentials and project-scoped queries."
            >
              <Input value={project.slug} readOnly className="font-mono" />
            </SettingField>
            <SettingField
              icon={Globe2}
              label="Allowed origin"
              description="The browser origin permitted to send same-origin events."
            >
              <Input value={project.origin} readOnly className="font-mono" />
            </SettingField>
          </div>
        </section>
        <section className="rounded-xl border bg-white shadow-soft">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h3 className="text-sm font-semibold">Collector</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Connection used for this project’s SDK traffic.
              </p>
            </div>
            <Badge
              variant={
                workspace.data.mode === "database" ? "success" : "warning"
              }
            >
              {workspace.data.mode}
            </Badge>
          </div>
          <div className="space-y-5 p-5">
            <SettingField
              icon={Globe2}
              label="Public collector URL"
              description="Server SDKs write here; browser SDKs use a same-origin proxy."
            >
              <Input
                value={
                  process.env.NEXT_PUBLIC_API_URL ??
                  "Not configured — demo mode"
                }
                readOnly
              />
            </SettingField>
            <SettingField
              icon={Database}
              label="Events today"
              description="Signals accepted for this project since midnight."
            >
              <Input value={project.eventsToday.toLocaleString()} readOnly />
            </SettingField>
          </div>
        </section>
        <section className="rounded-xl border bg-white shadow-soft">
          <div className="border-b p-5">
            <h3 className="text-sm font-semibold">Privacy defaults</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Enforced independently for {project.name}.
            </p>
          </div>
          <div className="divide-y">
            <PrivacyRow
              icon={ShieldCheck}
              title="Consent required"
              description="No visitor state is read or created while permission is undecided."
            />
            <PrivacyRow
              icon={Fingerprint}
              title="Project-isolated identity"
              description="Browser identifiers are transformed by a project-scoped HMAC."
            />
            <PrivacyRow
              icon={Database}
              title="90-day raw retention"
              description="Identifier-free daily rollups can outlive raw events."
            />
          </div>
        </section>
      </div>
    </ScrollableContent>
  );
}

function SettingField({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: typeof Globe2;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[240px_1fr]">
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
function PrivacyRow({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 p-5">
      <div className="grid size-9 place-items-center rounded-lg bg-[#edf3ee] text-[#347b56]">
        <Icon className="size-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Badge variant="success">On</Badge>
    </div>
  );
}
