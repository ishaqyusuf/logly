"use client";

import { Badge } from "@logly/ui/badge";
import { Checkbox } from "@logly/ui/checkbox";
import type { AnalyticsEventRow } from "@logly/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNowStrict } from "date-fns";
import { CircleDot, Server, UserRound } from "lucide-react";
import { ActionsMenu } from "./actions-menu";

export const columns: ColumnDef<AnalyticsEventRow>[] = [
  {
    id: "select",
    size: 46,
    enableHiding: false,
    enableResizing: false,
    meta: { sticky: true, skeleton: { type: "checkbox" } },
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) =>
          table.toggleAllPageRowsSelected(Boolean(value))
        }
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        aria-label="Select event"
      />
    ),
  },
  {
    id: "event",
    accessorKey: "name",
    size: 260,
    minSize: 210,
    meta: {
      sticky: true,
      skeleton: { type: "icon-text", width: "w-36" },
      headerLabel: "Event",
    },
    header: "Event",
    cell: ({ row }) => (
      <div className="flex min-w-[190px] items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#edf3ee] text-[#347b56]">
          <CircleDot className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-mono text-[12px] font-medium">
            {row.original.name}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            v1 · {row.original.id}
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "identity",
    accessorKey: "visitorKey",
    size: 170,
    meta: {
      skeleton: { type: "icon-text", width: "w-24" },
      headerLabel: "Identity",
    },
    header: "Identity",
    cell: ({ row }) =>
      row.original.visitorKey ? (
        <div className="flex items-center gap-2">
          <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-[11px]">
            {row.original.visitorKey}
          </span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">Server</span>
      ),
  },
  {
    id: "route",
    accessorKey: "route",
    size: 210,
    meta: { skeleton: { type: "text", width: "w-32" }, headerLabel: "Route" },
    header: "Route",
    cell: ({ row }) => (
      <span className="block max-w-[180px] truncate font-mono text-[11px] text-muted-foreground">
        {row.original.route ?? "—"}
      </span>
    ),
  },
  {
    id: "source",
    accessorKey: "source",
    size: 120,
    meta: { skeleton: { type: "badge", width: "w-16" }, headerLabel: "Source" },
    header: "Source",
    cell: ({ row }) => (
      <Badge
        variant={row.original.source === "server" ? "default" : "outline"}
        className="gap-1.5 capitalize"
      >
        {row.original.source === "server" && <Server className="h-2.5 w-2.5" />}
        {row.original.source}
      </Badge>
    ),
  },
  {
    id: "time",
    accessorKey: "occurredAt",
    size: 170,
    meta: {
      skeleton: { type: "text", width: "w-20" },
      headerLabel: "Received",
    },
    header: "Received",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDistanceToNowStrict(new Date(row.original.occurredAt), {
          addSuffix: true,
        })}
      </span>
    ),
  },
  {
    id: "actions",
    size: 48,
    enableHiding: false,
    enableResizing: false,
    meta: { skeleton: { type: "icon" }, headerLabel: "" },
    header: "",
    cell: ({ row }) => <ActionsMenu event={row.original} />,
  },
];
