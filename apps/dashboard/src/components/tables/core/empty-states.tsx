"use client";

import { Button } from "@logly/ui/button";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: ReactNode;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex min-h-[390px] items-center justify-center rounded-xl border bg-background">
      <div className="mt-8 flex flex-col items-center">
        <div className="mb-6 space-y-2 text-center">
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <Button variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

export function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      title="No results"
      description="Try another search, or adjust the filters."
      actionLabel="Clear filters"
      onAction={onClear}
    />
  );
}
