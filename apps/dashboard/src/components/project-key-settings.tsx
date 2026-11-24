"use client";

import { Button } from "@logly/ui/button";
import { Input } from "@logly/ui/input";
import { useState } from "react";

type Scope = "client-ingest" | "server-write" | "read" | "admin";

export function ProjectKeySettings({
  organization,
  project,
}: {
  organization: string;
  project: string;
}) {
  const [scope, setScope] = useState<Scope>("client-ingest");
  const [key, setKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  async function issueKey() {
    if (submitting || key) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/project-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organization, project, scope }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || typeof result.key?.value !== "string")
        throw new Error("Could not issue a project key. Try again.");
      setKey(result.key.value);
    } catch {
      setError("Could not issue a project key. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyKey() {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch {
      setError("Copy unavailable. Select and copy the key manually.");
    }
  }

  return (
    <section className="rounded-xl border bg-white shadow-soft">
      <div className="border-b p-5">
        <h3 className="text-sm font-semibold">Project keys</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Issue a new key when an original is unavailable. Existing keys remain
          active.
        </p>
      </div>
      <div className="space-y-4 p-5">
        {key ? (
          <>
            <p className="text-sm" role="status">
              New {scope} key created. Save it now; it will only be shown once.
            </p>
            <label
              className="block space-y-2 text-sm font-medium"
              htmlFor="reissued-project-key"
            >
              <span>{scope} key</span>
              <Input
                id="reissued-project-key"
                type={revealed ? "text" : "password"}
                value={key}
                readOnly
                autoComplete="off"
                className="min-w-0 font-mono text-xs"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void copyKey()}>
                {copied ? "Copied" : "Copy key"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRevealed(!revealed)}
              >
                {revealed ? "Hide key" : "Show key"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setKey(null);
                  setCopied(false);
                  setRevealed(false);
                  setError(null);
                }}
              >
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <label
              className="block space-y-2 text-sm font-medium"
              htmlFor="project-key-scope"
            >
              <span>Key scope</span>
              <select
                id="project-key-scope"
                value={scope}
                onChange={(event) => setScope(event.target.value as Scope)}
                disabled={submitting}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="client-ingest">
                  client-ingest — same-origin proxy
                </option>
                <option value="server-write">
                  server-write — signed server requests
                </option>
                <option value="read">read — project analytics</option>
                <option value="admin">admin — project management</option>
              </select>
            </label>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => void issueKey()}
            >
              {submitting ? "Issuing key…" : "Issue new key"}
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              Keep keys in your server environment. Logly stores only their
              hashes.
            </p>
          </>
        )}
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
