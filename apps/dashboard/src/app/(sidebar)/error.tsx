"use client";

import { Button } from "@logly/ui/button";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function SidebarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-5 grid h-11 w-11 place-items-center rounded-full border border-red-200 bg-red-50 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="font-semibold">The dashboard could not load</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The collector may be unavailable. Your product events remain queued by
          their SDKs.
        </p>
        <Button variant="outline" className="mt-5" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
