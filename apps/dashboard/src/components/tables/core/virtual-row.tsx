"use client";

import { cn } from "@logly/ui/cn";
import { TableCell, TableRow } from "@logly/ui/table";
import {
  type ColumnOrderState,
  type ColumnSizingState,
  flexRender,
  type Row,
  type VisibilityState,
} from "@tanstack/react-table";
import { type CSSProperties, memo, type ReactNode } from "react";
import { ACTIONS_FULL_WIDTH_CELL_CLASS, type TableColumnMeta } from "./types";

interface VirtualRowProps<TData> {
  row: Row<TData>;
  virtualStart: number;
  rowHeight: number;
  onCellClick?: (rowId: string, columnId: string) => void;
  getStickyStyle: (columnId: string) => CSSProperties;
  getStickyClassName: (columnId: string, baseClassName?: string) => string;
  nonClickableColumns?: Set<string>;
  columnSizing?: ColumnSizingState;
  columnOrder?: ColumnOrderState;
  columnVisibility?: VisibilityState;
  isSelected?: boolean;
}

function VirtualRowInner<TData>({
  row,
  virtualStart,
  rowHeight,
  onCellClick,
  getStickyStyle,
  getStickyClassName,
  nonClickableColumns = new Set(["select", "actions"]),
}: VirtualRowProps<TData>) {
  const cells = row.getVisibleCells();
  const hasNonStickyBeforeActions = cells.some(
    (cell) =>
      cell.column.id !== "actions" &&
      !(cell.column.columnDef.meta as TableColumnMeta | undefined)?.sticky,
  );
  return (
    <TableRow
      data-index={row.index}
      data-state={row.getIsSelected() ? "selected" : undefined}
      className="group absolute left-0 top-0 flex w-full min-w-full cursor-pointer items-center border-0 hover:bg-muted"
      style={{
        height: rowHeight,
        transform: `translateY(${virtualStart}px)`,
        contain: "layout style paint",
      }}
    >
      {cells.map((cell, index) => {
        const id = cell.column.id;
        const meta = cell.column.columnDef.meta as TableColumnMeta | undefined;
        const actionsFullWidth = id === "actions" && !hasNonStickyBeforeActions;
        const isLastBeforeActions =
          index === cells.length - 2 &&
          cells[cells.length - 1]?.column.id === "actions";
        return (
          <TableCell
            key={cell.id}
            className={cn(
              "flex h-full items-center border-b border-border",
              actionsFullWidth
                ? ACTIONS_FULL_WIDTH_CELL_CLASS
                : getStickyClassName(id, meta?.className),
              id === "actions" && "justify-center",
            )}
            style={{
              width: actionsFullWidth ? undefined : cell.column.getSize(),
              ...(!actionsFullWidth && getStickyStyle(id)),
              ...((isLastBeforeActions && !meta?.sticky) || actionsFullWidth
                ? { flex: 1 }
                : {}),
            }}
            onClick={() =>
              !nonClickableColumns.has(id) && onCellClick?.(row.id, id)
            }
          >
            <div className="w-full overflow-hidden truncate">
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function arePropsEqual<TData>(
  previous: VirtualRowProps<TData>,
  next: VirtualRowProps<TData>,
) {
  return (
    previous.row.id === next.row.id &&
    previous.virtualStart === next.virtualStart &&
    previous.rowHeight === next.rowHeight &&
    previous.isSelected === next.isSelected &&
    previous.columnSizing === next.columnSizing &&
    previous.columnOrder === next.columnOrder &&
    previous.columnVisibility === next.columnVisibility &&
    previous.row.original === next.row.original
  );
}

export const VirtualRow = memo(VirtualRowInner, arePropsEqual) as <TData>(
  props: VirtualRowProps<TData>,
) => ReactNode;
