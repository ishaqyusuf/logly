"use client";

import { closestCenter, DndContext } from "@dnd-kit/core";
import { Table, TableBody } from "@logly/ui/table";
import type {
  AnalyticsEventFilterOptions,
  AnalyticsEventPage,
  AnalyticsEventQuery,
} from "@logly/utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  getCoreRowModel,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence } from "framer-motion";
import { useCallback, useMemo, useRef, useState } from "react";
import { EventHeader } from "@/components/event-header";
import { VirtualRow } from "@/components/tables/core/virtual-row";
import { useEventFilterParams } from "@/hooks/use-event-filter-params";
import { useEventParams } from "@/hooks/use-event-params";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useTableDnd } from "@/hooks/use-table-dnd";
import { useTableSettings } from "@/hooks/use-table-settings";
import { BottomBar } from "./bottom-bar";
import { columns } from "./columns";
import { EmptyState, NoResults } from "./empty-states";
import { DataTableHeader } from "./table-header";

const NON_CLICKABLE_COLUMNS = new Set(["select", "actions"]);
const COLUMN_IDS = columns
  .map((column) => column.id)
  .filter((id): id is string => Boolean(id));

function makeSearchParams(query: AnalyticsEventQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return params;
}

export function DataTable({
  initialPage,
  options,
  scope,
}: {
  initialPage: AnalyticsEventPage;
  options: AnalyticsEventFilterOptions;
  scope: { organization?: string; project?: string };
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { filter, hasFilters } = useEventFilterParams();
  const { setParams } = useEventParams();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const {
    columnVisibility,
    setColumnVisibility,
    columnSizing,
    setColumnSizing,
    columnOrder,
    setColumnOrder,
  } = useTableSettings("events", COLUMN_IDS);
  const sources = filter.sources?.filter(
    (source): source is "browser" | "server" | "mobile" =>
      source === "browser" || source === "server" || source === "mobile",
  );
  const platforms = filter.platforms?.filter(
    (platform): platform is "web" | "ios" | "android" =>
      platform === "web" || platform === "ios" || platform === "android",
  );
  const query = useMemo<AnalyticsEventQuery>(
    () => ({
      ...scope,
      names: filter.names ?? undefined,
      sources,
      platforms,
      q: filter.q ?? undefined,
      start: filter.start ?? undefined,
      end: filter.end ?? undefined,
      sort: filter.sort as AnalyticsEventQuery["sort"],
      pageSize: 50,
    }),
    [
      filter.end,
      filter.names,
      filter.q,
      filter.sort,
      filter.start,
      scope,
      sources,
      platforms,
    ],
  );
  const initialQuery = useRef(JSON.stringify(query)).current;
  const useInitialPage = initialQuery === JSON.stringify(query);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["dashboard-events", query],
      queryFn: async ({ pageParam }) => {
        const response = await fetch(
          `/api/dashboard/events?${makeSearchParams({ ...query, cursor: pageParam })}`,
        );
        if (!response.ok) throw new Error("Could not load events");
        return response.json() as Promise<AnalyticsEventPage>;
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (page) => page.meta.cursor ?? undefined,
      initialData: useInitialPage
        ? { pages: [initialPage], pageParams: [undefined] }
        : undefined,
    });
  const tableData = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data?.pages],
  );
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    state: { rowSelection, columnVisibility, columnSizing, columnOrder },
  });
  const { sensors, handleDragEnd } = useTableDnd(table);
  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 57,
    overscan: 10,
  });
  useInfiniteScroll({
    scrollRef: parentRef,
    rowVirtualizer,
    rowCount: rows.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => {
      void fetchNextPage();
    },
  });
  const handleCellClick = useCallback(
    (rowId: string) => {
      void setParams({ eventId: rowId, eventType: "details" });
    },
    [setParams],
  );
  const stickyStyle = useCallback((columnId: string) => {
    if (columnId === "select")
      return { position: "sticky" as const, left: 0, zIndex: 12 };
    if (columnId === "event")
      return { position: "sticky" as const, left: 46, zIndex: 11 };
    if (columnId === "actions")
      return { position: "sticky" as const, right: 0, zIndex: 11 };
    return {};
  }, []);
  const stickyClassName = useCallback(
    (columnId: string, baseClassName?: string) =>
      `${baseClassName ?? ""} ${columnId === "select" || columnId === "event" || columnId === "actions" ? "sticky bg-background group-hover:bg-muted" : ""}`,
    [],
  );
  const exportEvents = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(tableData, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `logly-events-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <EventHeader
        eventNames={options.names}
        visible={columnVisibility}
        onToggle={(id) => table.getColumn(id)?.toggleVisibility()}
        onExport={exportEvents}
      />
      {hasFilters && !tableData.length ? (
        <NoResults />
      ) : !tableData.length ? (
        <EmptyState />
      ) : (
        <div className="relative">
          <div
            ref={parentRef}
            className="h-[620px] min-h-[390px] max-h-[calc(100vh-120px)] overflow-auto overscroll-contain rounded-xl border border-border bg-background shadow-soft scrollbar-hide"
          >
            <DndContext
              id="events-table-dnd"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table className="min-w-[900px]">
                <DataTableHeader table={table} containerRef={parentRef} />
                <TableBody
                  className="relative block"
                  style={{ height: rowVirtualizer.getTotalSize() }}
                >
                  {rowVirtualizer.getVirtualItems().map((item) => {
                    const row = rows[item.index];
                    return row ? (
                      <VirtualRow
                        key={row.id}
                        row={row}
                        virtualStart={item.start}
                        rowHeight={57}
                        onCellClick={handleCellClick}
                        nonClickableColumns={NON_CLICKABLE_COLUMNS}
                        getStickyStyle={stickyStyle}
                        getStickyClassName={stickyClassName}
                        columnSizing={columnSizing}
                        columnOrder={columnOrder}
                        columnVisibility={columnVisibility}
                        isSelected={rowSelection[row.id] ?? false}
                      />
                    ) : null;
                  })}
                </TableBody>
              </Table>
            </DndContext>
            {isFetchingNextPage && (
              <div className="sticky bottom-0 border-t bg-background/90 py-2 text-center text-xs text-muted-foreground backdrop-blur">
                Loading more events…
              </div>
            )}
          </div>
          <AnimatePresence>
            {Object.keys(rowSelection).length > 0 && (
              <BottomBar
                selected={table
                  .getSelectedRowModel()
                  .rows.map((row) => row.original)}
                onClear={() => setRowSelection({})}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
