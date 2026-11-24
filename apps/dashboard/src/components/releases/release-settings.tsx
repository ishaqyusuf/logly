"use client";

import { Badge } from "@logly/ui/badge";
import { Button } from "@logly/ui/button";
import { Input } from "@logly/ui/input";
import {
  type AnalyticsRelease,
  RELEASE_MAX_DESCRIPTION_LENGTH,
  RELEASE_MAX_VERSION_LENGTH,
  type ReleaseEnvironment,
} from "@logly/utils";
import { format } from "date-fns";
import { ExternalLink, Rocket, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

/** Local datetime-input value for a Date (minutes precision). */
function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ReleaseSettings({
  project,
  releases,
  canEdit,
}: {
  project: string;
  releases: AnalyticsRelease[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [version, setVersion] = useState("");
  const [environment, setEnvironment] =
    useState<ReleaseEnvironment>("production");
  const [deployedAt, setDeployedAt] = useState(() => toLocalInput(new Date()));
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addRelease(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/releases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project,
          version,
          environment,
          deployedAt: new Date(deployedAt).toISOString(),
          description: description || undefined,
          url: url || undefined,
        }),
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        created?: boolean;
      };
      if (!response.ok) throw new Error(result.error ?? "Could not add");
      setMessage(
        result.created
          ? `Added ${version}.`
          : `${version} was already recorded for ${environment}.`,
      );
      setVersion("");
      setDescription("");
      setUrl("");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not add the release.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function removeRelease(release: AnalyticsRelease) {
    if (!window.confirm(`Delete the ${release.version} marker?`)) return;
    setError(null);
    const params = new URLSearchParams({ project, id: release.id });
    const response = await fetch(`/api/releases?${params}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!response.ok) setError("Could not delete the release.");
    else router.refresh();
  }

  return (
    <section
      id="releases"
      className="scroll-mt-6 rounded-xl border bg-white shadow-soft"
    >
      <div className="border-b p-5">
        <h3 className="text-sm font-semibold">Releases</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Production releases appear as markers on the Overview and Events
          charts. Products record them with <code>logly-release</code> or{" "}
          <code>POST /v1/releases</code>; add one here by hand if needed.
        </p>
      </div>
      {canEdit ? (
        <form
          onSubmit={addRelease}
          className="grid gap-3 border-b p-5 sm:grid-cols-2"
        >
          <label
            htmlFor="release-version"
            className="space-y-1.5 text-xs font-medium"
          >
            <span>Version or commit</span>
            <Input
              id="release-version"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              placeholder="v1.4.0 or 3f2a9c1"
              maxLength={RELEASE_MAX_VERSION_LENGTH}
              pattern="[A-Za-z0-9][A-Za-z0-9._\-+/:@]*"
              title="No spaces"
              required
              className="font-mono"
            />
          </label>
          <label
            htmlFor="release-environment"
            className="space-y-1.5 text-xs font-medium"
          >
            <span>Environment</span>
            <select
              id="release-environment"
              value={environment}
              onChange={(event) =>
                setEnvironment(event.target.value as ReleaseEnvironment)
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="production">Production</option>
              <option value="preview">Preview</option>
            </select>
          </label>
          <label
            htmlFor="release-deployed-at"
            className="space-y-1.5 text-xs font-medium"
          >
            <span>Deployed at (your time)</span>
            <Input
              type="datetime-local"
              id="release-deployed-at"
              value={deployedAt}
              onChange={(event) => setDeployedAt(event.target.value)}
              required
            />
          </label>
          <label
            htmlFor="release-url"
            className="space-y-1.5 text-xs font-medium"
          >
            <span>Link (optional)</span>
            <Input
              type="url"
              id="release-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://github.com/…/releases/tag/v1.4.0"
              maxLength={500}
            />
          </label>
          <label
            htmlFor="release-description"
            className="space-y-1.5 text-xs font-medium sm:col-span-2"
          >
            <span>Description (optional)</span>
            <Input
              id="release-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Checkout redesign"
              maxLength={RELEASE_MAX_DESCRIPTION_LENGTH}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" size="sm" disabled={submitting || !version}>
              {submitting ? "Adding…" : "Add release marker"}
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
        </form>
      ) : null}
      {releases.length ? (
        <ul className="divide-y">
          {releases.map((release) => (
            <li key={release.id} className="flex items-start gap-3 px-5 py-3">
              <Rocket className="mt-0.5 size-4 shrink-0 text-[#b45309]" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="truncate font-mono font-medium">
                    {release.version}
                  </span>
                  <Badge
                    variant={
                      release.environment === "production"
                        ? "success"
                        : "outline"
                    }
                  >
                    {release.environment}
                  </Badge>
                  {release.source === "dashboard" ? (
                    <span className="text-[11px] text-muted-foreground">
                      added manually
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {format(new Date(release.deployedAt), "MMM d, yyyy · HH:mm")}
                  {release.description ? ` · ${release.description}` : ""}
                </p>
              </div>
              {release.url ? (
                <a
                  href={release.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={`Open ${release.version}`}
                >
                  <ExternalLink className="size-4" />
                </a>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => void removeRelease(release)}
                  className="mt-0.5 text-muted-foreground hover:text-red-600"
                  aria-label={`Delete ${release.version}`}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-5 text-xs text-muted-foreground">
          No releases recorded yet.
        </p>
      )}
    </section>
  );
}
