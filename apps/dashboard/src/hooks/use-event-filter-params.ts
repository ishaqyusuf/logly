import { useQueryStates } from "nuqs";
import { createLoader, parseAsArrayOf, parseAsString } from "nuqs/server";

export const eventFilterParamsSchema = {
  q: parseAsString,
  names: parseAsArrayOf(parseAsString),
  sources: parseAsArrayOf(parseAsString),
  platforms: parseAsArrayOf(parseAsString),
  start: parseAsString,
  end: parseAsString,
  sort: parseAsString.withDefault("occurred_at:desc"),
};

export function useEventFilterParams() {
  const [filter, setFilter] = useQueryStates(eventFilterParamsSchema, {
    history: "push",
    shallow: true,
  });
  return {
    filter,
    setFilter,
    hasFilters: Object.entries(filter).some(
      ([key, value]) => key !== "sort" && value !== null,
    ),
  };
}

export const loadEventFilterParams = createLoader(eventFilterParamsSchema);
