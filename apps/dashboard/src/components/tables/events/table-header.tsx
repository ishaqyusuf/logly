"use client";

import {
  horizontalListSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import { Button } from "@logly/ui/button";
import { TableHead, TableHeader, TableRow } from "@logly/ui/table";
import type { AnalyticsEventRow } from "@logly/utils";
import type { Header, Table } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { RefObject } from "react";
import { HorizontalPagination } from "@/components/horizontal-pagination";
import { DraggableHeader } from "@/components/tables/draggable-header";
import { ResizeHandle } from "@/components/tables/resize-handle";
import { useEventFilterParams } from "@/hooks/use-event-filter-params";

const NON_REORDERABLE = new Set(["select", "event", "actions"]);
const SORT_FIELDS: Record<string, string> = {
  event: "event_name",
  project: "project",
  source: "source",
  time: "occurred_at",
};
const LABELS: Record<string, string> = {
  event: "Event",
  project: "Project",
  identity: "Identity",
  route: "Route",
  source: "Source",
  time: "Received",
  actions: "",
};

export function DataTableHeader({
  table,
  containerRef,
}: {
  table: Table<AnalyticsEventRow>;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { filter, setFilter } = useEventFilterParams();
  const sortableIds = table
    .getAllLeafColumns()
    .filter((column) => !NON_REORDERABLE.has(column.id))
    .map((column) => column.id);
  return (
    <TableHeader className="sticky top-0 z-20 block w-full border-0 bg-background">
      {table.getHeaderGroups().map((group) => (
        <TableRow
          key={group.id}
          className="flex h-[45px] min-w-full items-center border-b hover:bg-transparent"
        >
          <SortableContext
            items={sortableIds}
            strategy={horizontalListSortingStrategy}
          >
            {group.headers.map((header) => {
              if (!header.column.getIsVisible()) return null;
              const id = header.column.id;
              const sticky =
                id === "select" || id === "event" || id === "actions";
              const style = {
                width: header.getSize(),
                minWidth: header.getSize(),
                ...(id === "select"
                  ? { position: "sticky" as const, left: 0, zIndex: 13 }
                  : {}),
                ...(id === "event"
                  ? { position: "sticky" as const, left: 46, zIndex: 12 }
                  : {}),
                ...(id === "actions"
                  ? { position: "sticky" as const, right: 0, zIndex: 12 }
                  : {}),
              };
              const content = (
                <HeaderContent
                  header={header}
                  sort={filter.sort}
                  onSort={(field) => {
                    const next =
                      filter.sort === `${field}:desc`
                        ? `${field}:asc`
                        : `${field}:desc`;
                    void setFilter({ sort: next });
                  }}
                  container={containerRef.current}
                />
              );
              if (sticky)
                return (
                  <TableHead
                    key={header.id}
                    className="relative flex h-full items-center border-t bg-background px-4"
                    style={style}
                  >
                    {content}
                    {header.column.getCanResize() && (
                      <ResizeHandle header={header} />
                    )}
                  </TableHead>
                );
              return (
                <DraggableHeader key={header.id} id={id} style={style}>
                  {content}
                  {header.column.getCanResize() && (
                    <ResizeHandle header={header} />
                  )}
                </DraggableHeader>
              );
            })}
          </SortableContext>
        </TableRow>
      ))}
    </TableHeader>
  );
}

function HeaderContent({
  header,
  sort,
  onSort,
  container,
}: {
  header: Header<AnalyticsEventRow, unknown>;
  sort: string;
  onSort: (field: string) => void;
  container: HTMLDivElement | null;
}) {
  const id = header.column.id;
  if (id === "select")
    return (
      <input
        type="checkbox"
        aria-label="Select all events"
        checked={header.getContext().table.getIsAllPageRowsSelected()}
        onChange={(event) =>
          header
            .getContext()
            .table.toggleAllPageRowsSelected(event.target.checked)
        }
        className="size-4"
      />
    );
  const field = SORT_FIELDS[id];
  const direction =
    sort === `${field}:asc` ? "asc" : sort === `${field}:desc` ? "desc" : null;
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-2">
      {field ? (
        <Button
          variant="ghost"
          className="h-auto min-w-0 justify-start p-0 text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:bg-transparent"
          onClick={(event) => {
            event.stopPropagation();
            onSort(field);
          }}
        >
          <span className="truncate">{LABELS[id]}</span>
          {direction === "asc" ? (
            <ArrowDown className="size-3.5" />
          ) : direction === "desc" ? (
            <ArrowUp className="size-3.5" />
          ) : null}
        </Button>
      ) : (
        <span className="truncate">{LABELS[id]}</span>
      )}
      {id === "event" && <HorizontalPagination container={container} />}
    </div>
  );
}
