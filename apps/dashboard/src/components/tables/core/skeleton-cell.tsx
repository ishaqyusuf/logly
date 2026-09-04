"use client";

import { cn } from "@logly/ui/cn";
import { Skeleton } from "@logly/ui/skeleton";
import type { SkeletonType } from "./types";

export function SkeletonCell({
  type,
  width = "w-24",
}: {
  type: SkeletonType;
  width?: string;
}) {
  if (type === "checkbox") return <Skeleton className="size-4" />;
  if (type === "avatar-text" || type === "icon-text")
    return (
      <div className="flex items-center gap-2">
        <Skeleton
          className={cn(
            "shrink-0",
            type === "avatar-text" ? "size-6 rounded-full" : "size-3",
          )}
        />
        <Skeleton className={cn("h-3.5", width)} />
      </div>
    );
  if (type === "tags")
    return (
      <div className="flex gap-1">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-5 w-16" />
      </div>
    );
  if (type === "icon") return <Skeleton className="size-5" />;
  return <Skeleton className={cn(type === "badge" ? "h-5" : "h-3.5", width)} />;
}
