"use client";

import { cn } from "@logly/ui/cn";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@logly/ui/dropdown-menu";
import { Input } from "@logly/ui/input";
import {
  CalendarDays,
  Filter,
  RadioTower,
  Search,
  Tags,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useEventFilterParams } from "@/hooks/use-event-filter-params";

type FilterKey = "names" | "sources" | "platforms";

export function EventSearchFilter({ eventNames }: { eventNames: string[] }) {
  const { filter, setFilter } = useEventFilterParams();
  const [input, setInput] = useState(filter.q ?? "");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setInput(filter.q ?? ""), [filter.q]);

  useHotkeys(
    "esc",
    () => {
      setInput("");
      void setFilter(null);
      setOpen(false);
    },
    { enableOnFormTags: true, enabled: Boolean(input) || open },
  );
  useHotkeys("meta+s", (event) => {
    event.preventDefault();
    inputRef.current?.focus();
  });

  const toggle = (key: FilterKey, value: string) => {
    const current = filter[key] ?? [];
    void setFilter({
      [key]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  };
  const selectedCount =
    (filter.names?.length ?? 0) +
    (filter.sources?.length ?? 0) +
    (filter.platforms?.length ?? 0) +
    (filter.start || filter.end ? 1 : 0);

  return (
    <div className="flex min-w-0 flex-1 flex-col items-start gap-3 sm:flex-row sm:items-center">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <form
          className="relative w-full sm:w-[350px]"
          onSubmit={(event) => {
            event.preventDefault();
            void setFilter({ q: input || null });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-[11px] size-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (!event.target.value) void setFilter({ q: null });
            }}
            placeholder="Search events…"
            className="w-full bg-background pl-9 pr-10"
            autoComplete="off"
            spellCheck={false}
          />
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Filter events"
              className={cn(
                "absolute right-3 top-[10px] text-muted-foreground transition-colors hover:text-foreground",
                (open || selectedCount > 0) && "text-foreground",
              )}
            >
              <Filter className="size-4" />
              {selectedCount > 0 && (
                <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-[#347b56] text-[9px] font-semibold text-white">
                  {selectedCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
        </form>
        <DropdownMenuContent
          className="w-[350px]"
          sideOffset={19}
          alignOffset={-11}
          side="bottom"
          align="end"
        >
          <FilterSubmenu icon={CalendarDays} label="Date range">
            <div className="w-[300px] space-y-3 p-3">
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                From
                <input
                  type="date"
                  value={filter.start?.slice(0, 10) ?? ""}
                  onChange={(event) =>
                    void setFilter({
                      start: event.target.value
                        ? new Date(
                            `${event.target.value}T00:00:00.000Z`,
                          ).toISOString()
                        : null,
                    })
                  }
                  className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                />
              </label>
              <label className="grid gap-1.5 text-xs text-muted-foreground">
                To
                <input
                  type="date"
                  value={filter.end?.slice(0, 10) ?? ""}
                  onChange={(event) =>
                    void setFilter({
                      end: event.target.value
                        ? new Date(
                            `${event.target.value}T23:59:59.999Z`,
                          ).toISOString()
                        : null,
                    })
                  }
                  className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                />
              </label>
            </div>
          </FilterSubmenu>
          <FilterSubmenu icon={Tags} label="Event name">
            <Options
              items={eventNames}
              selected={filter.names ?? []}
              onToggle={(value) => toggle("names", value)}
              empty="No events found"
            />
          </FilterSubmenu>
          <FilterSubmenu icon={RadioTower} label="Source">
            <Options
              items={["browser", "mobile", "server"]}
              selected={filter.sources ?? []}
              onToggle={(value) => toggle("sources", value)}
              empty="No sources found"
            />
          </FilterSubmenu>
          <FilterSubmenu icon={RadioTower} label="Platform">
            <Options
              items={["web", "ios", "android"]}
              selected={filter.platforms ?? []}
              onToggle={(value) => toggle("platforms", value)}
              empty="No platforms found"
            />
          </FilterSubmenu>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {filter.names?.map((value) => (
          <FilterChip
            key={`name-${value}`}
            label={value}
            onRemove={() => toggle("names", value)}
            mono
          />
        ))}
        {filter.sources?.map((value) => (
          <FilterChip
            key={`source-${value}`}
            label={value}
            onRemove={() => toggle("sources", value)}
          />
        ))}
        {filter.platforms?.map((value) => (
          <FilterChip
            key={`platform-${value}`}
            label={value}
            onRemove={() => toggle("platforms", value)}
          />
        ))}
        {(filter.start || filter.end) && (
          <FilterChip
            label={`${filter.start?.slice(0, 10) ?? "Any"} – ${filter.end?.slice(0, 10) ?? "Now"}`}
            onRemove={() => void setFilter({ start: null, end: null })}
          />
        )}
      </div>
    </div>
  );
}

function FilterSubmenu({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Filter;
  label: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Icon className="mr-2 size-4" />
          {label}
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent
            sideOffset={12}
            className="max-h-[320px] overflow-auto p-0"
          >
            {children}
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>
    </DropdownMenuGroup>
  );
}

function Options({
  items,
  selected,
  onToggle,
  empty,
}: {
  items: string[];
  selected: string[];
  onToggle: (value: string) => void;
  empty: string;
}) {
  if (!items.length)
    return <p className="px-3 py-2 text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="min-w-[220px] p-1">
      {items.map((item) => (
        <DropdownMenuCheckboxItem
          key={item}
          checked={selected.includes(item)}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={() => onToggle(item)}
        >
          <span className="truncate font-mono text-xs">{item}</span>
        </DropdownMenuCheckboxItem>
      ))}
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
  mono,
}: {
  label: string;
  onRemove: () => void;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex h-8 max-w-56 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <span className={cn("truncate", mono && "font-mono")}>{label}</span>
      <X className="size-3" />
    </button>
  );
}
