import type { ColumnDef } from "@tanstack/react-table";
import type { RefObject } from "react";

export type SkeletonType =
  | "checkbox"
  | "text"
  | "avatar-text"
  | "icon-text"
  | "badge"
  | "tags"
  | "icon";
export interface SkeletonConfig {
  type: SkeletonType;
  width?: string;
}
export interface TableColumnMeta {
  className?: string;
  sticky?: boolean;
  sortField?: string;
  skeleton?: SkeletonConfig;
  headerLabel?: string;
}
export interface StickyColumnConfig {
  id: string;
  width: number;
}
export interface TableScrollState {
  containerRef: RefObject<HTMLDivElement | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  isScrollable: boolean;
  scrollLeft: () => void;
  scrollRight: () => void;
}
export interface TableConfig {
  tableId: "events";
  stickyColumns: StickyColumnConfig[];
  sortFieldMap: Record<string, string>;
  nonReorderableColumns: Set<string>;
  rowHeight: number;
  summaryGridHeight?: number;
}
export function getColumnId<T>(column: ColumnDef<T>) {
  return column.id || (column as { accessorKey?: string }).accessorKey || "";
}
export function getHeaderLabel<T>(column: ColumnDef<T>) {
  const meta = column.meta as TableColumnMeta | undefined;
  if (meta?.headerLabel) return meta.headerLabel;
  return getColumnId(column)
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase())
    .trim();
}
export const ACTIONS_FULL_WIDTH_HEADER_CLASS =
  "group/header relative h-full px-4 border-t border-border flex items-center justify-center bg-background z-10";
export const ACTIONS_STICKY_HEADER_CLASS =
  "group/header relative h-full px-4 border-t border-l border-border flex items-center justify-center sticky right-0 bg-background z-10";
export const ACTIONS_FULL_WIDTH_CELL_CLASS =
  "bg-background group-hover:bg-muted";
