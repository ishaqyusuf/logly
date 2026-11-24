"use client";

import { Button } from "@logly/ui/button";
import { Field, FieldLabel } from "@logly/ui/field";
import { Input } from "@logly/ui/input";
import { NativeSelect } from "@logly/ui/native-select";
import {
  FUNNEL_BREAKDOWNS,
  FUNNEL_MAX_NAME_LENGTH,
  FUNNEL_MAX_STEPS,
  FUNNEL_MIN_STEPS,
  FUNNEL_WINDOWS,
  type FunnelBreakdown,
  type FunnelEventOption,
  type FunnelStep,
  type FunnelWindow,
  type SavedFunnel,
  serializeFunnelSteps,
} from "@logly/utils";
import { ArrowDown, Plus, Save, Trash2, X } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useMemo, useState } from "react";
import { DeprecatedBadge } from "@/components/event-catalog/deprecated-events";
import { FUNNEL_RANGES, type FunnelRange } from "@/lib/funnel-params";
import { breakdownLabels, windowLabels } from "./funnel-format";

type DraftStep = {
  event: string;
  route: string;
  propertyKey: string;
  propertyValue: string;
};

const toDraft = (step: FunnelStep): DraftStep => ({
  event: step.event,
  route: step.route ?? "",
  propertyKey: step.property?.key ?? "",
  propertyValue: step.property?.value ?? "",
});
const emptyStep = (): DraftStep => ({
  event: "",
  route: "",
  propertyKey: "",
  propertyValue: "",
});

function toSteps(drafts: DraftStep[]): FunnelStep[] {
  return drafts.map((draft) => ({
    event: draft.event.trim(),
    ...(draft.route.trim() ? { route: draft.route.trim() } : {}),
    ...(draft.propertyKey && draft.propertyValue.trim()
      ? {
          property: {
            key: draft.propertyKey,
            value: draft.propertyValue.trim(),
          },
        }
      : {}),
  }));
}

export function FunnelBuilder({
  scope,
  project,
  events,
  hidden,
  routes,
  saved,
  initialSteps,
  initialWindow,
  initialRange,
  initialBreakdown,
  canEdit,
}: {
  /** `organization`/`project` query string for links. */
  scope: string;
  project: string;
  events: FunnelEventOption[];
  /** Names hidden in the event catalog; typed ones still work. */
  hidden?: string[];
  routes: string[];
  saved: SavedFunnel | null;
  initialSteps: FunnelStep[] | null;
  initialWindow: FunnelWindow;
  initialRange: FunnelRange;
  initialBreakdown: FunnelBreakdown | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const ids = useId();
  const [steps, setSteps] = useState<DraftStep[]>(() =>
    initialSteps?.length
      ? initialSteps.map(toDraft)
      : [emptyStep(), emptyStep()],
  );
  const [conversionWindow, setConversionWindow] =
    useState<FunnelWindow>(initialWindow);
  const [range, setRange] = useState<FunnelRange>(initialRange);
  const [breakdown, setBreakdown] = useState<FunnelBreakdown | "">(
    initialBreakdown ?? "",
  );
  const [name, setName] = useState(saved?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const known = useMemo(
    () => new Map(events.map((event) => [event.name, event.properties])),
    [events],
  );
  const deprecated = useMemo(
    () =>
      new Set(
        events.filter((event) => event.deprecated).map((event) => event.name),
      ),
    [events],
  );
  const complete = steps.every((step) => step.event.trim());
  const valid =
    complete &&
    steps.length >= FUNNEL_MIN_STEPS &&
    steps.length <= FUNNEL_MAX_STEPS;

  function update(index: number, patch: Partial<DraftStep>) {
    setSteps((current) =>
      current.map((step, position) =>
        position === index ? { ...step, ...patch } : step,
      ),
    );
  }

  function href(funnelId?: string | null) {
    const params = new URLSearchParams(scope);
    if (funnelId) params.set("funnel", funnelId);
    params.set("steps", serializeFunnelSteps(toSteps(steps)));
    params.set("window", conversionWindow);
    params.set("range", range);
    if (breakdown) params.set("breakdown", breakdown);
    return `/funnels?${params}` as Route;
  }

  function run(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    router.push(href(saved?.id));
  }

  async function send(method: "POST" | "PATCH" | "DELETE") {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const deleting = method === "DELETE";
      const response = await fetch(
        deleting
          ? `/api/funnels?${new URLSearchParams({ project, id: saved?.id ?? "" })}`
          : "/api/funnels",
        {
          method,
          headers: { "content-type": "application/json" },
          body: deleting
            ? undefined
            : JSON.stringify({
                ...(method === "PATCH" ? { id: saved?.id } : {}),
                project,
                name,
                steps: toSteps(steps),
                window: conversionWindow,
              }),
          cache: "no-store",
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        funnel?: SavedFunnel;
      };
      if (!response.ok) throw new Error(result.error ?? "Request failed");
      if (deleting) {
        router.push(`/funnels?${scope}` as Route);
      } else {
        setMessage(method === "POST" ? "Funnel saved." : "Funnel updated.");
        router.push(href(result.funnel?.id));
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={run}
      className="flex flex-col gap-5 rounded-xl border bg-white p-5 shadow-soft"
    >
      <datalist id={`${ids}-events`}>
        {events.map((event) => (
          <option
            key={event.name}
            value={event.name}
            label={event.deprecated ? "Deprecated" : undefined}
          />
        ))}
      </datalist>
      <datalist id={`${ids}-routes`}>
        {routes.map((route) => (
          <option key={route} value={route} />
        ))}
      </datalist>
      <div>
        <p className="text-sm font-semibold">
          {saved ? saved.name : "New funnel"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Steps must happen in order for the same visitor, within the conversion
          window of their first step.
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => {
          const properties = known.get(step.event.trim()) ?? [];
          const unknown =
            step.event.trim() !== "" && !known.has(step.event.trim());
          return (
            <li key={index} className="flex flex-col gap-2">
              {index > 0 ? (
                <ArrowDown
                  aria-hidden="true"
                  className="ml-3 size-3.5 text-muted-foreground"
                />
              ) : null}
              <fieldset className="grid gap-3 rounded-lg border bg-[#fbfaf7] p-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-end">
                <legend className="sr-only">Step {index + 1}</legend>
                <Field>
                  <FieldLabel htmlFor={`${ids}-event-${index}`}>
                    Step {index + 1} event
                  </FieldLabel>
                  <Input
                    id={`${ids}-event-${index}`}
                    list={`${ids}-events`}
                    value={step.event}
                    placeholder="Search events"
                    autoComplete="off"
                    spellCheck={false}
                    required
                    aria-invalid={unknown || undefined}
                    onChange={(event) =>
                      update(index, {
                        event: event.target.value,
                        propertyKey: "",
                        propertyValue: "",
                      })
                    }
                    className="font-mono text-xs"
                  />
                  {unknown && hidden?.includes(step.event.trim()) ? (
                    <p className="text-[11px] text-muted-foreground">
                      Hidden in the event catalog
                    </p>
                  ) : unknown ? (
                    <p className="text-[11px] text-amber-700">
                      Not seen in the last 30 days
                    </p>
                  ) : null}
                  {deprecated.has(step.event.trim()) ? (
                    <DeprecatedBadge
                      name={step.event.trim()}
                      deprecated
                      className="self-start"
                    />
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${ids}-route-${index}`}>
                    Route (optional)
                  </FieldLabel>
                  <Input
                    id={`${ids}-route-${index}`}
                    list={`${ids}-routes`}
                    value={step.route}
                    placeholder="/orders/:id"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) =>
                      update(index, { route: event.target.value })
                    }
                    className="font-mono text-xs"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${ids}-key-${index}`}>
                    Property equals (optional)
                  </FieldLabel>
                  <div className="flex gap-2">
                    <NativeSelect
                      id={`${ids}-key-${index}`}
                      value={step.propertyKey}
                      disabled={!properties.length}
                      onChange={(event) =>
                        update(index, { propertyKey: event.target.value })
                      }
                      className="min-w-0 flex-1 font-mono text-xs"
                    >
                      <option value="">
                        {properties.length ? "Any property" : "No properties"}
                      </option>
                      {properties.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </NativeSelect>
                    <Input
                      aria-label={`Step ${index + 1} property value`}
                      value={step.propertyValue}
                      disabled={!step.propertyKey}
                      maxLength={200}
                      placeholder="value"
                      onChange={(event) =>
                        update(index, { propertyValue: event.target.value })
                      }
                      className="min-w-0 flex-1 font-mono text-xs"
                    />
                  </div>
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove step ${index + 1}`}
                  disabled={steps.length <= FUNNEL_MIN_STEPS}
                  onClick={() =>
                    setSteps((current) =>
                      current.filter((_, position) => position !== index),
                    )
                  }
                >
                  <X className="size-4" />
                </Button>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={steps.length >= FUNNEL_MAX_STEPS}
        onClick={() => setSteps((current) => [...current, emptyStep()])}
      >
        <Plus className="size-4" />
        Add step
        <span className="text-muted-foreground">
          {steps.length}/{FUNNEL_MAX_STEPS}
        </span>
      </Button>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor={`${ids}-window`}>Conversion window</FieldLabel>
          <NativeSelect
            id={`${ids}-window`}
            value={conversionWindow}
            onChange={(event) =>
              setConversionWindow(event.target.value as FunnelWindow)
            }
          >
            {(Object.keys(FUNNEL_WINDOWS) as FunnelWindow[]).map((option) => (
              <option key={option} value={option}>
                {windowLabels[option]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${ids}-range`}>Date range</FieldLabel>
          <NativeSelect
            id={`${ids}-range`}
            value={range}
            onChange={(event) => setRange(event.target.value as FunnelRange)}
          >
            {(Object.keys(FUNNEL_RANGES) as FunnelRange[]).map((option) => (
              <option key={option} value={option}>
                Last {FUNNEL_RANGES[option]} days
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${ids}-breakdown`}>Break down by</FieldLabel>
          <NativeSelect
            id={`${ids}-breakdown`}
            value={breakdown}
            onChange={(event) =>
              setBreakdown(event.target.value as FunnelBreakdown | "")
            }
          >
            <option value="">No breakdown</option>
            {FUNNEL_BREAKDOWNS.map((option) => (
              <option key={option} value={option}>
                {breakdownLabels[option]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t pt-4">
        <Button type="submit" disabled={!valid || busy}>
          Run funnel
        </Button>
        {canEdit ? (
          <>
            <Field className="min-w-[200px] flex-1 sm:max-w-xs">
              <FieldLabel htmlFor={`${ids}-name`}>Funnel name</FieldLabel>
              <Input
                id={`${ids}-name`}
                value={name}
                maxLength={FUNNEL_MAX_NAME_LENGTH}
                placeholder="Quote to accept"
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            {saved ? (
              <Button
                type="button"
                variant="outline"
                disabled={!valid || !name.trim() || busy}
                onClick={() => send("PATCH")}
              >
                <Save className="size-4" />
                Update
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={!valid || !name.trim() || busy}
              onClick={() => send("POST")}
            >
              <Save className="size-4" />
              {saved ? "Save as new" : "Save funnel"}
            </Button>
            {saved ? (
              <Button
                type="button"
                variant="ghost"
                className="text-red-700"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Delete “${saved.name}”?`)) void send("DELETE");
                }}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only admins can save, edit or delete funnels.
          </p>
        )}
      </div>
      {message ? (
        <p role="status" className="text-xs text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
