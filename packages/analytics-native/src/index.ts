import {
  type AnalyticsBatch,
  type AnalyticsEvent,
  type AnalyticsPlatform,
  type EventProperty,
  eventNameSchema,
  LOGLY_CORE_VERSION,
  sanitizeProperties,
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
  sanitizeRoute?: (route: string) => string;
  flushIntervalMs?: number;
};

const MAX_QUEUE_EVENTS = 250;
const MAX_QUEUE_AGE_MS = 86_400_000;

export function sanitizeNativeRoute(route: string) {
  const pathname = route.split(/[?#]/, 1)[0] || "/";
  const safe = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      /^\d+$/.test(segment) ||
      /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) ||
      segment.length > 64
        ? ":id"
        : segment,
    )
    .join("/");
  return `/${safe}`.slice(0, 256);
}

export function createNativeAnalytics(config: NativeAnalyticsConfig) {
  const now = config.now ?? (() => new Date());
  const visitorKey = `logly:${config.project}:native-visitor`;
  const queueKey = `logly:${config.project}:native-queue`;
  const safeRoute = config.sanitizeRoute ?? sanitizeNativeRoute;
  let visitor: NativeVisitor | null = null;
  let queue: AnalyticsEvent[] = [];
  let initialized = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let inFlight: Promise<void> | undefined;
  let lastRoute: string | null = null;

  const persistQueue = async () => {
    if (queue.length)
      await config.storage.setItem(queueKey, JSON.stringify(queue));
    else await config.storage.removeItem(queueKey);
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
          (event) => current - Date.parse(event.occurredAt) < MAX_QUEUE_AGE_MS,
        )
        .slice(-MAX_QUEUE_EVENTS);
      const events = queue.slice(0, 25);
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
      properties: sanitizeProperties(properties),
    };
    queue.push(event);
    queue = queue.slice(-MAX_QUEUE_EVENTS);
    await persistQueue();
    void flush();
  };

  const trackSession = async (route?: string) => {
    if (!initialized || !visitor) return;
    const day = now().toISOString().slice(0, 10);
    if (visitor.lastSessionOn === day) return;
    const visitKind = visitor.firstSeenOn === day ? "new" : "returning";
    visitor.lastSessionOn = day;
    await config.storage.setItem(visitorKey, JSON.stringify(visitor));
    await enqueue("app_session", {}, route, visitKind);
  };

  return {
    async init() {
      if (initialized || config.enabled === false) return;
      try {
        const [storedVisitor, storedQueue] = await Promise.all([
          config.storage.getItem(visitorKey),
          config.storage.getItem(queueKey),
        ]);
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
          ? parsedQueue.slice(-MAX_QUEUE_EVENTS)
          : [];
        initialized = true;
        await config.storage.setItem(visitorKey, JSON.stringify(visitor));
        timer = setInterval(
          () => void flush(),
          config.flushIntervalMs ?? 60_000,
        );
      } catch {
        initialized = false;
        visitor = null;
      }
    },
    trackSession,
    async trackScreenView(route: string) {
      if (!initialized) return;
      const safe = safeRoute(route);
      await trackSession(safe);
      if (lastRoute === safe) return;
      lastRoute = safe;
      await enqueue("screen_view", {}, safe);
    },
    track(name: string, properties?: Record<string, EventProperty>) {
      return enqueue(name, properties);
    },
    flush,
    async destroy() {
      if (timer) clearInterval(timer);
      await flush();
      initialized = false;
      visitor = null;
      lastRoute = null;
    },
  };
}
