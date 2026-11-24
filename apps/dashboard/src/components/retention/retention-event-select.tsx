"use client";

import { NativeSelect } from "@logly/ui/native-select";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";

/** Picks what counts as returning: any event, or one event name. */
export function RetentionEventSelect({
  query,
  value,
  names,
  deprecated = [],
}: {
  query: string;
  value: string | null;
  names: string[];
  /** Deprecated in the event catalog; hidden names are already left out. */
  deprecated?: string[];
}) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const options = value && !names.includes(value) ? [value, ...names] : names;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <label htmlFor={id} className="whitespace-nowrap">
        Returning means
      </label>
      <NativeSelect
        id={id}
        value={value ?? ""}
        disabled={pending}
        className="h-9 w-[180px] bg-white text-xs"
        onChange={(event) => {
          const params = new URLSearchParams(query);
          if (event.target.value) params.set("event", event.target.value);
          else params.delete("event");
          startTransition(() =>
            router.push(`/retention?${params}` as Route, { scroll: false }),
          );
        }}
      >
        <option value="">Any event</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {deprecated.includes(name) ? `${name} (deprecated)` : name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
