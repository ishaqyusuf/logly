"use client";

import { Button } from "@logly/ui/button";
import { Checkbox } from "@logly/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@logly/ui/field";
import { Input } from "@logly/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@logly/ui/sheet";
import {
  EVENT_CATALOG_DESCRIPTION_MAX,
  EVENT_CATALOG_NOTES_MAX,
  type EventCatalogEntry,
} from "@logly/utils";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useState } from "react";

/** Admin editor for one event's catalog metadata (PUT /api/event-catalog). */
export function CatalogEditSheet({
  project,
  event,
  onClose,
}: {
  project: string;
  event: EventCatalogEntry | null;
  onClose: () => void;
}) {
  const ids = useId();
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [deprecated, setDeprecated] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDescription(event?.description ?? "");
    setNotes(event?.notes ?? "");
    setDeprecated(event?.deprecated ?? false);
    setHidden(event?.hidden ?? false);
    setError(null);
  }, [event]);

  async function save(submit: FormEvent) {
    submit.preventDefault();
    if (!event || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/event-catalog", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project,
          name: event.name,
          description,
          notes,
          deprecated,
          hidden,
        }),
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Request failed");
      onClose();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-base">{event?.name}</SheetTitle>
          <SheetDescription>
            Notes for people reading this project. Event data is never renamed,
            merged or deleted.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={save} className="mt-6 flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${ids}-description`}>
                Description
              </FieldLabel>
              <Input
                id={`${ids}-description`}
                value={description}
                maxLength={EVENT_CATALOG_DESCRIPTION_MAX}
                onChange={(change) => setDescription(change.target.value)}
                placeholder="What this event means and when it fires"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${ids}-notes`}>Owner / notes</FieldLabel>
              <textarea
                id={`${ids}-notes`}
                value={notes}
                maxLength={EVENT_CATALOG_NOTES_MAX}
                rows={4}
                onChange={(change) => setNotes(change.target.value)}
                placeholder="Team or person who owns it, replacement name, links"
                className="min-h-[88px] rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
              />
              <p className="text-[11px] text-muted-foreground">
                Don&apos;t add email addresses or other personal details.
              </p>
            </Field>
            <div className="flex items-start gap-2.5">
              <Checkbox
                id={`${ids}-deprecated`}
                checked={deprecated}
                onCheckedChange={(value) => setDeprecated(value === true)}
                className="mt-0.5"
              />
              <div>
                <FieldLabel htmlFor={`${ids}-deprecated`}>
                  Deprecated
                </FieldLabel>
                <p className="text-xs text-muted-foreground">
                  Shows a badge here, in the Events view and in event pickers.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Checkbox
                id={`${ids}-hidden`}
                checked={hidden}
                onCheckedChange={(value) => setHidden(value === true)}
                className="mt-0.5"
              />
              <div>
                <FieldLabel htmlFor={`${ids}-hidden`}>
                  Hide from pickers
                </FieldLabel>
                <p className="text-xs text-muted-foreground">
                  Removes the name from the funnel builder, retention and Events
                  filters. It stays in this catalog and its data is still
                  counted.
                </p>
              </div>
            </div>
          </FieldGroup>
          {error ? (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
