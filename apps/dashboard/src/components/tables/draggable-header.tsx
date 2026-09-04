"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@logly/ui/cn";
import { TableHead } from "@logly/ui/table";
import { GripVertical } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

export function DraggableHeader({
  id,
  children,
  className,
  style,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <TableHead
      ref={setNodeRef}
      className={cn(
        "group/header relative flex h-full select-none items-center border-t border-border px-4",
        isDragging && "z-50 border bg-background",
        className,
      )}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        ...style,
      }}
    >
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      <GripVertical
        className="ml-1 size-3.5 shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover/header:opacity-100"
        {...attributes}
        {...listeners}
      />
    </TableHead>
  );
}
