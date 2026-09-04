"use client";

import type { Header } from "@tanstack/react-table";

export function ResizeHandle<TData>({
  header,
}: {
  header: Header<TData, unknown>;
}) {
  return (
    <button
      type="button"
      aria-label={`Resize ${header.column.id} column`}
      onDoubleClick={() => header.column.resetSize()}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      className="absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize touch-none select-none after:absolute after:left-1/2 after:top-1/4 after:h-1/2 after:w-px after:bg-border hover:after:bg-foreground/40"
    />
  );
}
