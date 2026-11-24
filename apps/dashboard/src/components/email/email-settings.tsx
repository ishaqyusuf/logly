"use client";

import { Badge } from "@logly/ui/badge";
import { Button } from "@logly/ui/button";
import { Checkbox } from "@logly/ui/checkbox";
import { ExternalLink, Mail, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type EmailOperatorRow = {
  userId: string;
  name: string;
  email: string;
  project: { digest: boolean; alerts: boolean };
  organization: { digest: boolean; alerts: boolean };
};

type Scope = "project" | "organization";

/**
 * Admin-managed email opt-ins for the selected project and its
 * organization, plus the digest preview and a test send to yourself.
 */
export function EmailSettings({
  project,
  projectName,
  organizationName,
  operators,
  delivery,
}: {
  project: string;
  projectName: string;
  organizationName: string;
  operators: EmailOperatorRow[];
  delivery: { enabled: boolean; reason?: string };
}) {
  const router = useRouter();
  const [rows, setRows] = useState(operators);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function toggle(
    row: EmailOperatorRow,
    scope: Scope,
    kind: "digest" | "alerts",
    value: boolean,
  ) {
    const next = { ...row[scope], [kind]: value };
    const key = `${row.userId}:${scope}:${kind}`;
    setPending(key);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/email/subscriptions", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project,
          userId: row.userId,
          scope,
          weeklyDigest: next.digest,
          trackingAlerts: next.alerts,
        }),
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Could not save");
      setRows((current) =>
        current.map((item) =>
          item.userId === row.userId ? { ...item, [scope]: next } : item,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setPending(null);
    }
  }

  async function sendTest() {
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/email/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project }),
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Could not send");
      setMessage("Test digest sent to your email.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  const preview = `/api/email/preview?${new URLSearchParams({ project })}`;
  const cell = (
    row: EmailOperatorRow,
    scope: Scope,
    kind: "digest" | "alerts",
  ) => {
    const key = `${row.userId}:${scope}:${kind}`;
    const label = `${kind === "digest" ? "Weekly digest" : "Tracking alerts"} for ${
      scope === "project" ? projectName : `all ${organizationName} projects`
    }: ${row.name}`;
    return (
      <td className="px-3 py-2.5 text-center">
        <Checkbox
          aria-label={label}
          checked={row[scope][kind]}
          disabled={pending !== null}
          onCheckedChange={(checked) =>
            toggle(row, scope, kind, checked === true)
          }
          className={pending === key ? "opacity-50" : undefined}
        />
      </td>
    );
  };

  return (
    <section
      id="email"
      className="scroll-mt-6 rounded-xl border bg-white shadow-soft"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="size-4 text-muted-foreground" /> Email
          </h3>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
            A weekly digest of last Monday–Sunday goes out on Monday morning,
            and alert emails when tracking stops or recovers. Choose who gets
            them for this project, or for every project in {organizationName}.
          </p>
        </div>
        <Badge variant={delivery.enabled ? "success" : "warning"}>
          {delivery.enabled ? "Sending" : "Not sending"}
        </Badge>
      </div>
      {!delivery.enabled ? (
        <p className="border-b bg-[#fbf8ef] px-5 py-3 text-xs leading-5 text-[#7a5b12]">
          {delivery.reason ?? "Email is disabled"}. Opt-ins are saved and take
          effect once the production deployment can send.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-5 py-2 text-left font-medium" rowSpan={2}>
                Operator
              </th>
              <th className="px-3 pt-2 font-medium" colSpan={2}>
                {projectName}
              </th>
              <th className="px-3 pt-2 font-medium" colSpan={2}>
                All {organizationName} projects
              </th>
            </tr>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-3 pb-2 font-normal">Digest</th>
              <th className="px-3 pb-2 font-normal">Alerts</th>
              <th className="px-3 pb-2 font-normal">Digest</th>
              <th className="px-3 pb-2 font-normal">Alerts</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.userId}>
                <td className="px-5 py-2.5">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.email}</p>
                </td>
                {cell(row, "project", "digest")}
                {cell(row, "project", "alerts")}
                {cell(row, "organization", "digest")}
                {cell(row, "organization", "alerts")}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t p-5">
        <Button asChild size="sm" variant="outline">
          <a href={preview} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" /> Preview digest
          </a>
        </Button>
        <a
          href={`${preview}&format=text`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          Text version
        </a>
        <Button
          size="sm"
          variant="outline"
          onClick={sendTest}
          disabled={sending || !delivery.enabled}
          title={delivery.enabled ? undefined : delivery.reason}
        >
          <Send className="size-3.5" />
          {sending ? "Sending…" : "Send test digest to me"}
        </Button>
        {message ? (
          <p className="text-xs text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
