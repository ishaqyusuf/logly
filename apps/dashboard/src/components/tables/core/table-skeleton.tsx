"use client";

import { cn } from "@logly/ui/cn";
import { Skeleton } from "@logly/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@logly/ui/table";
import type {
  ColumnDef,
  ColumnSizingState,
  VisibilityState,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { SkeletonCell } from "./skeleton-cell";
import { getColumnId, getHeaderLabel, type TableColumnMeta } from "./types";

export function TableSkeleton<TData>({
  columns,
  rowCount = 12,
  columnVisibility = {},
  columnSizing = {},
  columnOrder = [],
  stickyColumnIds = [],
  actionsColumnId = "actions",
  isEmpty = false,
  className,
}: {
  columns: ColumnDef<TData>[];
  rowCount?: number;
  columnVisibility?: VisibilityState;
  columnSizing?: ColumnSizingState;
  columnOrder?: string[];
  stickyColumnIds?: string[];
  actionsColumnId?: string;
  isEmpty?: boolean;
  className?: string;
}) {
  const rows = useMemo(
    () =>
      Array.from({ length: rowCount }, (_, index) => ({ id: String(index) })),
    [rowCount],
  );
  const visibleColumns = useMemo(() => {
    const ordered = columnOrder.length
      ? [
          ...(columnOrder
            .map((id) => columns.find((column) => getColumnId(column) === id))
            .filter(Boolean) as ColumnDef<TData>[]),
          ...columns.filter(
            (column) => !columnOrder.includes(getColumnId(column)),
          ),
        ]
      : columns;
    return ordered.filter((column) => {
      const id = getColumnId(column);
      return (
        id === "select" ||
        id === actionsColumnId ||
        columnVisibility[id] !== false
      );
    });
  }, [actionsColumnId, columnOrder, columnVisibility, columns]);
  let stickyLeft = 0;
  const styleFor = (column: ColumnDef<TData>) => {
    const id = getColumnId(column);
    const width = columnSizing[id] ?? column.size ?? 150;
    const style = {
      width,
      minWidth: width,
      maxWidth: width,
      ...(stickyColumnIds.includes(id)
        ? { position: "sticky" as const, left: stickyLeft, zIndex: 10 }
        : {}),
      ...(id === actionsColumnId
        ? { position: "sticky" as const, right: 0, zIndex: 10 }
        : {}),
    };
    if (stickyColumnIds.includes(id)) stickyLeft += width;
    return style;
  };
  return (
    <div className={cn("w-full", className)}>
      <div className="overflow-hidden rounded-xl border bg-background">
        <Table
          className={cn(
            "min-w-[1050px]",
            isEmpty && "pointer-events-none opacity-20 blur-[7px]",
          )}
        >
          <TableHeader className="block bg-background">
            <TableRow className="flex h-[45px] items-center hover:bg-transparent">
              {visibleColumns.map((column) => (
                <TableHead
                  key={getColumnId(column)}
                  className="flex h-full items-center border-r px-4 last:border-r-0"
                  style={styleFor(column)}
                >
                  {getColumnId(column) === "select" ? (
                    <Skeleton className="size-4" />
                  ) : (
                    <span>{getHeaderLabel(column)}</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="block">
            {rows.map((row) => {
              stickyLeft = 0;
              return (
                <TableRow key={row.id} className="flex h-[57px] items-center">
                  {visibleColumns.map((column) => {
                    const meta = column.meta as TableColumnMeta | undefined;
                    return (
                      <TableCell
                        key={getColumnId(column)}
                        className="flex h-full items-center border-r px-4 last:border-r-0"
                        style={styleFor(column)}
                      >
                        {meta?.skeleton ? (
                          <SkeletonCell
                            type={meta.skeleton.type}
                            width={meta.skeleton.width}
                          />
                        ) : (
                          <Skeleton className="h-3.5 w-24" />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
