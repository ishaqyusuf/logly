import {
  type AnalyticsBatch,
  type AnalyticsEvent,
  type AnalyticsPlatform,
  analyticsEventSchema,
  createAnalyticsContext,
  createRouteNormalizer,
  type EventProperty,
  eventNameSchema,
  fitsAnalyticsEventBudget,
  LOGLY_CORE_VERSION,
  normalizeRoute,
  type RouteTemplateOptions,
} from "@ishaqyusuf/logly-core";

export type NativeAnalyticsStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type NativeVisitor = {
  id: string;
  firstSeenOn: string;
  lastSessionOn: string | null;
};

export type NativeAnalyticsConfig = {
  project: string;
  endpoint: string;
  platform: Exclude<AnalyticsPlatform, "web">;
  appVersion?: string;
  appBuild?: string;
  storage: NativeAnalyticsStorage;
  createId: () => string;
  enabled?: boolean;
  now?: () => Date;
  send?: (batch: AnalyticsBatch) => Promise<void>;
  /** Project rules for route templates such as `/jobs/:id`. */
  routeTemplates?: RouteTemplateOptions;
  /** Replaces route templating entirely. */
  sanitizeRoute?: (route: string) => string;
  flushIntervalMs?: number;
};

const MAX_QUEUE_EVENTS = 250;
const MAX_QUEUE_AGE_MS = 86_400_000;

export function sanitizeNativeRoute(route: string) {
  return normalizeRoute(route);
}

export function createNativeAnalytics(config: NativeAnalyticsConfig) {
  const now = config.now ?? (() => new Date());
  const visitorKey = `logly:${config.project}:native-visitor`;
  const queueKey = `logly:${config.project}:native-queue`;
  const safeRoute =
    config.sanitizeRoute ??
    (config.routeTemplates
      ? createRouteNormalizer(config.routeTemplates)
      : sanitizeNativeRoute);
  let visitor: NativeVisitor | null = null;
  let queue: AnalyticsEvent[] = [];
  let initialized = false;
  let lifecycleGeneration = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let inFlight: Promise<void> | undefined;
  let lastRoute: string | null = null;
  const analyticsContext = createAnalyticsContext();

  let pendingQueueWrite = Promise.resolve();
  const persistQueue = () => {
    const serialized = queue.length ? JSON.stringify(queue) : null;
    pendingQueueWrite = pendingQueueWrite
      .catch(() => {})
      .then(() =>
        serialized
          ? config.storage.setItem(queueKey, serialized)
          : config.storage.removeItem(queueKey),
      );
    return pendingQueueWrite;
  };

  let pendingVisitorWrite = Promise.resolve();
  const persistVisitor = () => {
    const serialized = visitor ? JSON.stringify(visitor) : null;
    pendingVisitorWrite = pendingVisitorWrite
      .catch(() => {})
      .then(() =>
        serialized
          ? config.storage.setItem(visitorKey, serialized)
          : config.storage.removeItem(visitorKey),
      );
    return pendingVisitorWrite;
  };

  const send =
    config.send ??
    (async (batch: AnalyticsBatch) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4_000);
      try {
        const response = await fetch(config.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(batch),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Analytics delivery failed");
      } finally {
        clearTimeout(timeout);
      }
    });

  const flush = () => {
    if (inFlight) return inFlight;
    if (!initialized || !queue.length) return Promise.resolve();
    inFlight = (async () => {
      const current = now().getTime();
      queue = queue
        .filter(
          (event) =>
            fitsAnalyticsEventBudget(event) &&
            current - Date.parse(event.occurredAt) < MAX_QUEUE_AGE_MS,
        )
        .slice(-MAX_QUEUE_EVENTS);
      const events: AnalyticsEvent[] = [];
      let bytes = 512;
      for (const event of queue.slice(0, 25)) {
        const eventBytes =
          new TextEncoder().encode(JSON.stringify(event)).byteLength + 1;
        if (bytes + eventBytes > 48 * 1024) break;
        events.push(event);
        bytes += eventBytes;
      }
      if (!events.length) {
        await persistQueue();
        return;
      }
      try {
        await send({
          sentAt: now().toISOString(),
          sdk: { name: "@ishaqyusuf/logly-core", version: LOGLY_CORE_VERSION },
          events,
        });
        const delivered = new Set(events.map((event) => event.eventId));
        queue = queue.filter((event) => !delivered.has(event.eventId));
      } catch {
        // Delivery is best effort; stable IDs remain queued for retry.
      }
      await persistQueue();
    })().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };

  const enqueue = async (
    name: string,
    properties: Record<string, unknown> = {},
    route?: string,
    visitKind?: "new" | "returning",
    snapshot = analyticsContext.snapshot(properties),
  ) => {
    if (!initialized || !visitor || !eventNameSchema.safeParse(name).success)
      return;
    const event: AnalyticsEvent = {
      eventId: config.createId(),
      project: config.project,
      name,
      version: 1,
      source: "mobile",
      platform: config.platform,
      appVersion: config.appVersion?.slice(0, 64),
      appBuild: config.appBuild?.slice(0, 64),
      occurredAt: now().toISOString(),
      visitorId: visitor.id,
      visitKind,
      route: route ? safeRoute(route) : undefined,
      ...snapshot,
    };
    if (!fitsAnalyticsEventBudget(event)) return;
    queue.push(event);
    queue = queue.slice(-MAX_QUEUE_EVENTS);
    await persistQueue();
    void flush();
  };

  const trackSession = async (
    route?: string,
    snapshot = analyticsContext.snapshot(),
  ) => {
    if (!initialized || !visitor) return;
    const day = now().toISOString().slice(0, 10);
    if (visitor.lastSessionOn === day) return;
    const visitKind = visitor.firstSeenOn === day ? "new" : "returning";
    visitor.lastSessionOn = day;
    const pendingEvent = enqueue("app_session", {}, route, visitKind, snapshot);
    await persistVisitor();
    await pendingEvent;
  };

  return {
    identify(actorId: string) {
      const accepted = analyticsContext.identify(actorId);
      if (accepted) lastRoute = null;
      return accepted;
    },
    group(
      type: string,
      key: string,
      properties?: Record<string, EventProperty>,
    ) {
      const accepted = analyticsContext.group(type, key, properties);
      if (accepted) lastRoute = null;
      return accepted;
    },
    clearGroup(type: string) {
      analyticsContext.clearGroup(type);
      lastRoute = null;
    },
    setGlobalProperties: analyticsContext.setGlobalProperties,
    unsetGlobalProperties: analyticsContext.unsetGlobalProperties,
    async reset() {
      lifecycleGeneration++;
      analyticsContext.reset();
      queue = [];
      lastRoute = null;
      visitor = initialized
        ? {
            id: config.createId(),
            firstSeenOn: now().toISOString().slice(0, 10),
            lastSessionOn: null,
          }
        : null;
      await persistQueue();
      await persistVisitor();
    },
    async init() {
      if (initialized || config.enabled === false) return;
      const generation = ++lifecycleGeneration;
      try {
        const [storedVisitor, storedQueue] = await Promise.all([
          config.storage.getItem(visitorKey),
          config.storage.getItem(queueKey),
        ]);
        if (generation !== lifecycleGeneration) return;
        const parsedVisitor = storedVisitor ? JSON.parse(storedVisitor) : null;
        const parsedQueue = storedQueue ? JSON.parse(storedQueue) : [];
        const day = now().toISOString().slice(0, 10);
        visitor =
          parsedVisitor &&
          typeof parsedVisitor.id === "string" &&
          typeof parsedVisitor.firstSeenOn === "string"
            ? parsedVisitor
            : { id: config.createId(), firstSeenOn: day, lastSessionOn: null };
        queue = Array.isArray(parsedQueue)
          ? parsedQueue.slice(-MAX_QUEUE_EVENTS).flatMap((value: unknown) => {
              const parsed = analyticsEventSchema.safeParse(value);
              return parsed.success &&
                parsed.data.project === config.project &&
                fitsAnalyticsEventBudget(parsed.data)
                ? [parsed.data]
                : [];
            })
          : [];
        initialized = true;
        await persistVisitor();
        if (generation !== lifecycleGeneration) return;
        timer = setInterval(
          () => void flush(),
          config.flushIntervalMs ?? 60_000,
        );
      } catch {
        if (generation !== lifecycleGeneration) return;
        initialized = false;
        visitor = null;
      }
    },
    trackSession,
    async trackScreenView(route: string) {
      if (!initialized) return;
      const safe = safeRoute(route);
      const snapshot = analyticsContext.snapshot();
      const session = trackSession(safe, snapshot);
      if (lastRoute === safe) {
        await session;
        return;
      }
      lastRoute = safe;
      await enqueue("screen_view", {}, safe, undefined, snapshot);
      await session;
    },
    track(name: string, properties?: Record<string, EventProperty>) {
      return enqueue(name, properties);
    },
    flush,
    async destroy() {
      lifecycleGeneration++;
      if (timer) clearInterval(timer);
      await flush();
      initialized = false;
      visitor = null;
      lastRoute = null;
    },
  };
}
