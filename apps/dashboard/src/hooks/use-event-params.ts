import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

const eventParamsSchema = {
  eventId: parseAsString,
  eventType: parseAsStringEnum(["details"]),
};

export function useEventParams() {
  const [params, setParams] = useQueryStates(eventParamsSchema);
  return { ...params, setParams };
}
