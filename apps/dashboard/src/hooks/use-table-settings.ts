"use client";

import type {
  ColumnOrderState,
  ColumnSizingState,
  VisibilityState,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";

type Settings = {
  columnVisibility: VisibilityState;
  columnSizing: ColumnSizingState;
  columnOrder: ColumnOrderState;
};

export function useTableSettings(tableId: string, columnIds: string[]) {
  const storageKey = `logly:table:${tableId}`;
  const [settings, setSettings] = useState<Settings>({
    columnVisibility: {},
    columnSizing: {},
    columnOrder: columnIds,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<Settings>;
        setSettings((current) => ({
          ...current,
          ...parsed,
          columnOrder: [
            ...(parsed.columnOrder ?? []).filter((id) =>
              columnIds.includes(id),
            ),
            ...columnIds.filter(
              (id) => !(parsed.columnOrder ?? []).includes(id),
            ),
          ],
        }));
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    setHydrated(true);
  }, [columnIds, storageKey]);

  useEffect(() => {
    if (hydrated)
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [hydrated, settings, storageKey]);

  return {
    ...settings,
    setColumnVisibility: (
      value: VisibilityState | ((state: VisibilityState) => VisibilityState),
    ) =>
      setSettings((current) => ({
        ...current,
        columnVisibility:
          typeof value === "function" ? value(current.columnVisibility) : value,
      })),
    setColumnSizing: (
      value:
        | ColumnSizingState
        | ((state: ColumnSizingState) => ColumnSizingState),
    ) =>
      setSettings((current) => ({
        ...current,
        columnSizing:
          typeof value === "function" ? value(current.columnSizing) : value,
      })),
    setColumnOrder: (
      value: ColumnOrderState | ((state: ColumnOrderState) => ColumnOrderState),
    ) =>
      setSettings((current) => ({
        ...current,
        columnOrder:
          typeof value === "function" ? value(current.columnOrder) : value,
      })),
  };
}
