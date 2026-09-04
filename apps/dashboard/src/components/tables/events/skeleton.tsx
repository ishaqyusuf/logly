"use client";

import { TableSkeleton } from "@/components/tables/core/table-skeleton";
import { columns } from "./columns";

export function EventSkeleton() {
  return (
    <TableSkeleton
      columns={columns}
      rowCount={9}
      stickyColumnIds={["select", "event"]}
    />
  );
}
