import {
  type FunnelBreakdown,
  type FunnelStep,
  type FunnelWindow,
  isFunnelBreakdown,
  isFunnelWindow,
  normalizeFunnelSteps,
  parseFunnelStepsParam,
  type SavedFunnel,
} from "@logly/utils";

export const FUNNEL_RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type FunnelRange = keyof typeof FUNNEL_RANGES;

export type FunnelPageState = {
  /** Selected saved funnel, if any (its steps load unless `steps` is set). */
  saved: SavedFunnel | null;
  steps: FunnelStep[] | null;
  window: FunnelWindow;
  range: FunnelRange;
  breakdown: FunnelBreakdown | null;
  error: string | null;
};

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * Funnel URL state: `funnel` (saved id), `steps` (JSON), `window`, `range`
 * and `breakdown`. Explicit params override the saved funnel's definition so
 * an edited, unsaved funnel stays shareable by URL.
 */
export function readFunnelParams(
  params: Record<string, string | string[] | undefined>,
  funnels: SavedFunnel[],
): FunnelPageState {
  const id = first(params.funnel);
  const saved = funnels.find((funnel) => funnel.id === id) ?? null;
  const rawRange = first(params.range);
  const range: FunnelRange =
    rawRange && Object.hasOwn(FUNNEL_RANGES, rawRange)
      ? (rawRange as FunnelRange)
      : "30d";
  const rawWindow = first(params.window);
  const window = isFunnelWindow(rawWindow)
    ? rawWindow
    : (saved?.window ?? "1d");
  const rawBreakdown = first(params.breakdown);
  const breakdown = isFunnelBreakdown(rawBreakdown) ? rawBreakdown : null;
  let steps: FunnelStep[] | null = saved?.steps ?? null;
  let error: string | null = null;
  const rawSteps = first(params.steps);
  if (rawSteps) {
    try {
      steps = normalizeFunnelSteps(parseFunnelStepsParam(rawSteps));
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Invalid steps";
      steps = null;
    }
  }
  return { saved, steps, window, range, breakdown, error };
}
