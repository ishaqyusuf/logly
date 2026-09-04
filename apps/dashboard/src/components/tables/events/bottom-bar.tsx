"use client";

import { Button } from "@logly/ui/button";
import type { AnalyticsEventRow } from "@logly/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { BottomBar as CoreBottomBar } from "@/components/tables/core";

export function BottomBar({
  selected,
  onClear,
}: {
  selected: AnalyticsEventRow[];
  onClear: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!selected.length) return null;
  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(selected, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <CoreBottomBar selectedCount={selected.length} onDeselect={onClear}>
      <Button size="sm" onClick={copy}>
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
        {copied ? "Copied" : "Copy JSON"}
      </Button>
    </CoreBottomBar>
  );
}
