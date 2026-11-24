"use client";

import { Badge } from "@logly/ui/badge";
import { cn } from "@logly/ui/cn";
import { createContext, useContext, useMemo } from "react";

/**
 * Names marked deprecated in the event catalog, for badges in the Events view
 * and its pickers. Hidden names are already left out of the picker options.
 */
const DeprecatedEventsContext = createContext<ReadonlySet<string>>(new Set());

export function DeprecatedEventsProvider({
  names,
  children,
}: {
  names: string[] | undefined;
  children: React.ReactNode;
}) {
  const value = useMemo(() => new Set(names ?? []), [names]);
  return (
    <DeprecatedEventsContext.Provider value={value}>
      {children}
    </DeprecatedEventsContext.Provider>
  );
}

export function DeprecatedBadge({
  name,
  deprecated,
  className,
}: {
  name: string;
  /** Overrides the context, for pickers that carry the flag themselves. */
  deprecated?: boolean;
  className?: string;
}) {
  const names = useContext(DeprecatedEventsContext);
  if (!(deprecated ?? names.has(name))) return null;
  return (
    <Badge
      variant="warning"
      className={cn("shrink-0 px-1.5 py-0 text-[10px]", className)}
      title="Deprecated in the event catalog"
    >
      Deprecated
    </Badge>
  );
}
