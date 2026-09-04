"use client";

import type { Virtualizer } from "@tanstack/react-virtual";
import { type RefObject, useEffect } from "react";

export function useInfiniteScroll<TElement extends HTMLElement>({
  scrollRef,
  rowVirtualizer,
  rowCount,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  threshold = 20,
}: {
  scrollRef: RefObject<TElement | null>;
  rowVirtualizer: Virtualizer<TElement, Element>;
  rowCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  threshold?: number;
}) {
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    const checkLoadMore = () => {
      if (isFetchingNextPage) return;
      const items = rowVirtualizer.getVirtualItems();
      const last = items[items.length - 1];
      if (last && last.index >= rowCount - threshold && hasNextPage) {
        fetchNextPage();
      }
    };
    checkLoadMore();
    scrollElement.addEventListener("scroll", checkLoadMore);
    return () => scrollElement.removeEventListener("scroll", checkLoadMore);
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    rowCount,
    rowVirtualizer,
    scrollRef,
    threshold,
  ]);
}
