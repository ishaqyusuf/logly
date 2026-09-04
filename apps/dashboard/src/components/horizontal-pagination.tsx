"use client";

import { Button } from "@logly/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function HorizontalPagination({
  container,
}: {
  container: HTMLDivElement | null;
}) {
  if (!container || container.scrollWidth <= container.clientWidth) return null;
  const move = (direction: number) =>
    container.scrollBy({
      left: direction * Math.max(240, container.clientWidth / 2),
      behavior: "smooth",
    });
  return (
    <div className="hidden items-center gap-2 md:flex">
      <Button
        variant="outline"
        size="icon"
        className="size-6 bg-background"
        onClick={() => move(-1)}
        aria-label="Scroll columns left"
      >
        <ChevronLeft className="size-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-6 bg-background"
        onClick={() => move(1)}
        aria-label="Scroll columns right"
      >
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}
