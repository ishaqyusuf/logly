"use client";

import { Button } from "@logly/ui/button";
import { Input } from "@logly/ui/input";
import type { AnalyticsGroupOption } from "@logly/utils";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useEventFilterParams } from "@/hooks/use-event-filter-params";

export function EventContextFilter({ project }: { project: string }) {
  const { filter, setFilter } = useEventFilterParams();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState("string");
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const groups = useQuery({
    queryKey: ["dashboard-groups", project, query],
    queryFn: async () => {
      const response = await fetch(
        `/api/dashboard/groups?${new URLSearchParams({ project, q: query })}`,
      );
      if (!response.ok) throw new Error("Could not load groups");
      return response.json() as Promise<{
        data: AnalyticsGroupOption[];
        hasMore: boolean;
      }>;
    },
  });
  const selected =
    filter.groupType && filter.groupKey
      ? `${filter.groupType}:${filter.groupKey}`
      : "";
  const options = groups.data?.data ?? [];
  return (
    <section
      aria-label="Group and property filters"
      className="space-y-4 rounded-xl border bg-background p-4"
    >
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label
          htmlFor="group-search"
          className="grid min-w-0 flex-1 gap-1.5 text-xs sm:min-w-48"
        >
          Find a group
          <Input
            id="group-search"
            aria-label="Find a group"
            value={search}
            maxLength={128}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, type or reference"
          />
        </label>
        <label className="grid min-w-0 flex-1 gap-1.5 text-xs sm:min-w-48">
          Group
          <select
            aria-label="Group"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={selected}
            onChange={(event) => {
              const option = options.find(
                (item) => `${item.type}:${item.key}` === event.target.value,
              );
              void setFilter({
                groupType: option?.type ?? null,
                groupKey: option?.key ?? null,
              });
            }}
          >
            <option value="">All groups and unattributed events</option>
            {selected &&
              !options.some(
                (item) => `${item.type}:${item.key}` === selected,
              ) && (
                <option value={selected}>
                  {filter.groupType}: {filter.groupKey?.slice(0, 12)}…
                </option>
              )}
            {options.map((item) => (
              <option
                key={`${item.type}:${item.key}`}
                value={`${item.type}:${item.key}`}
              >
                {item.name} · {item.type} · {item.key.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <Button
            variant="outline"
            onClick={() => void setFilter({ groupType: null, groupKey: null })}
          >
            Clear group
          </Button>
        )}
      </div>
      {groups.isPending && (
        <p className="text-xs text-muted-foreground">Loading groups…</p>
      )}
      {groups.isError && (
        <p role="alert" className="text-xs text-destructive">
          Groups could not be loaded.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void groups.refetch()}
          >
            Retry
          </button>
        </p>
      )}
      {groups.data?.hasMore && (
        <p className="text-xs text-muted-foreground">
          Showing 50 matches. Refine your search to find another group.
        </p>
      )}
      {groups.data && !options.length && (
        <p className="text-xs text-muted-foreground">
          No matching groups. Groups appear when attributed events arrive.
        </p>
      )}
      <form
        className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          if (!key.trim()) {
            setError("Enter a property name.");
            return;
          }
          let scalar: string | number | boolean | null = value;
          if (type === "number") {
            scalar = Number(value);
            if (!value.trim() || !Number.isFinite(scalar)) {
              setError("Enter a valid number.");
              return;
            }
          }
          if (type === "boolean") {
            if (value !== "true" && value !== "false") {
              setError("Choose true or false.");
              return;
            }
            scalar = value === "true";
          }
          if (type === "null") scalar = null;
          void setFilter({
            propertyKey: key.trim(),
            propertyValue: JSON.stringify(scalar),
          });
        }}
      >
        <label
          htmlFor="property-key"
          className="grid min-w-0 flex-1 gap-1.5 text-xs"
        >
          Event property
          <Input
            id="property-key"
            aria-label="Event property"
            value={key}
            maxLength={64}
            onChange={(event) => setKey(event.target.value)}
            placeholder="e.g. channel"
          />
        </label>
        <label className="grid gap-1.5 text-xs">
          Value type
          <select
            aria-label="Value type"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setValue(event.target.value === "boolean" ? "true" : "");
            }}
          >
            <option value="string">Text</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="null">Null</option>
          </select>
        </label>
        {type !== "null" && (
          <label
            htmlFor="property-value"
            className="grid min-w-0 flex-1 gap-1.5 text-xs"
          >
            Equals
            {type === "boolean" ? (
              <select
                id="property-value"
                aria-label="Property value"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <Input
                id="property-value"
                aria-label="Property value"
                value={value}
                maxLength={256}
                onChange={(event) => setValue(event.target.value)}
              />
            )}
          </label>
        )}
        <Button type="submit" variant="outline">
          Apply property
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {filter.propertyKey && (
        <Button
          variant="outline"
          className="max-w-full"
          onClick={() =>
            void setFilter({ propertyKey: null, propertyValue: null })
          }
        >
          <span className="truncate">
            {filter.propertyKey} = {filter.propertyValue}
          </span>{" "}
          · Clear
        </Button>
      )}
      {filter.actor && (
        <Button
          variant="outline"
          className="max-w-full"
          onClick={() => void setFilter({ actor: null })}
        >
          <span className="truncate">User: {filter.actor}</span> · Clear
        </Button>
      )}
    </section>
  );
}
