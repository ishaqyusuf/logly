"use client";

import { useTrack } from "@ishaqyusuf/logly-next";
import { Button } from "@logly/ui/button";
import { Input } from "@logly/ui/input";
import type { AnalyticsOrganizationSummary } from "@logly/utils";
import { Check, Copy, LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

type ProjectKeys = Record<
  "client-ingest" | "server-write" | "read" | "admin",
  string
>;

type CreatedProject = {
  project: { id: string; name: string; slug: string };
  keys: ProjectKeys;
};

export function ProjectCreateForm({
  disabled,
  organizations,
}: {
  disabled: boolean;
  organizations: AnalyticsOrganizationSummary[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const track = useTrack();
  const [name, setName] = useState("");
  const [allowedOrigins, setAllowedOrigins] = useState("");
  const [organizationId, setOrganizationId] = useState(
    organizations.find(
      (organization) => organization.slug === searchParams.get("organization"),
    )?.id ??
      organizations[0]?.id ??
      "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedProject | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, allowedOrigins, organizationId }),
      });
      const result = (await response.json()) as CreatedProject & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error ?? "Project creation failed");
      setCreated(result);
      track("project_created");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Project creation failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(scope: keyof ProjectKeys) {
    if (!created) return;
    await navigator.clipboard.writeText(created.keys[scope]);
    setCopied(scope);
    window.setTimeout(() => setCopied(null), 1800);
  }

  if (created) {
    return (
      <div className="space-y-5 py-7">
        <div className="rounded-xl border border-[#b8d8c1] bg-[#eff8f1] p-4 text-sm text-[#285d3d]">
          <p className="font-medium">{created.project.name} is connected.</p>
          <p className="mt-1 text-xs leading-5">
            Copy these credentials now. Logly stores only their hashes and will
            not show the plaintext values again.
          </p>
        </div>
        <div className="space-y-4">
          {(Object.keys(created.keys) as Array<keyof ProjectKeys>).map(
            (scope) => (
              <label
                key={scope}
                htmlFor={`project-key-${scope}`}
                className="block space-y-2 text-sm font-medium"
              >
                <span>{scope}</span>
                <span className="flex gap-2">
                  <Input
                    id={`project-key-${scope}`}
                    aria-label={`${scope} credential`}
                    className="font-mono text-xs"
                    readOnly
                    value={created.keys[scope]}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Copy ${scope} credential`}
                    onClick={() => void copy(scope)}
                  >
                    {copied === scope ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </span>
              </label>
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-5 py-7" onSubmit={submit}>
      <label
        className="block space-y-2 text-sm font-medium"
        htmlFor="project-organization"
      >
        <span>Organization</span>
        <select
          id="project-organization"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/5"
          onChange={(event) => setOrganizationId(event.target.value)}
          required
          value={organizationId}
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="Project name"
        name="name"
        placeholder="Afterservice"
        value={name}
        onChange={setName}
      />
      <label
        className="block space-y-2 text-sm font-medium"
        htmlFor="project-allowed-origins"
      >
        <span>Allowed production origins</span>
        <textarea
          id="project-allowed-origins"
          name="allowed-origins"
          className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground/40 focus:ring-2 focus:ring-foreground/5"
          placeholder={
            "https://www.afterservice.app\nhttps://dashboard.afterservice.app"
          }
          value={allowedOrigins}
          onChange={(event) => setAllowedOrigins(event.target.value)}
          autoComplete="off"
          required
        />
        <span className="block text-xs font-normal leading-5 text-muted-foreground">
          Separate up to 10 HTTPS origins with commas or new lines.
        </span>
      </label>
      <div className="rounded-xl border border-border bg-white p-4 text-xs leading-5 text-muted-foreground">
        Valid event names are discovered automatically when your application
        sends them. Logly creates separate client-ingest, server-write, read,
        and admin credentials; each plaintext credential is shown once.
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button
        className="w-full"
        disabled={disabled || submitting}
        type="submit"
      >
        {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {disabled ? "Connect Postgres to enable" : "Create project"}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `project-${name}`;
  return (
    <label htmlFor={id} className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      <Input
        id={id}
        name={name}
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        required
      />
    </label>
  );
}
