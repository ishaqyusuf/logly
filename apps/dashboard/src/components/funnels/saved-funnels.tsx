import { cn } from "@logly/ui/cn";
import type { SavedFunnel } from "@logly/utils";
import type { Route } from "next";
import Link from "next/link";
import { windowLabels } from "./funnel-format";

export function SavedFunnels({
  scope,
  funnels,
  selected,
}: {
  scope: string;
  funnels: SavedFunnel[];
  selected: string | null;
}) {
  const link = (id?: string) => {
    const params = new URLSearchParams(scope);
    if (id) params.set("funnel", id);
    return `/funnels?${params}` as Route;
  };
  return (
    <nav
      aria-label="Saved funnels"
      className="flex flex-col gap-1 rounded-xl border bg-white p-3 shadow-soft"
    >
      <p className="px-2 pb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Saved funnels
      </p>
      <Link
        href={link()}
        aria-current={selected === null ? "page" : undefined}
        className={cn(
          "rounded-md px-2 py-1.5 text-sm",
          selected === null
            ? "bg-muted font-medium"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        + New funnel
      </Link>
      {funnels.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          None yet. Admins can save a funnel to revisit it here.
        </p>
      ) : (
        funnels.map((funnel) => (
          <Link
            key={funnel.id}
            href={link(funnel.id)}
            aria-current={selected === funnel.id ? "page" : undefined}
            className={cn(
              "flex flex-col rounded-md px-2 py-1.5",
              selected === funnel.id ? "bg-muted" : "hover:bg-muted",
            )}
          >
            <span className="truncate text-sm font-medium">{funnel.name}</span>
            <span className="text-[11px] text-muted-foreground">
              {funnel.steps.length} steps · {windowLabels[funnel.window]}
            </span>
          </Link>
        ))
      )}
    </nav>
  );
}
