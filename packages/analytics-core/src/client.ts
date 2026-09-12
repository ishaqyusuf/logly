import type { AnalyticsBatch, AnalyticsEvent } from "./contracts";
import {
  eventNameSchema,
  LOGLY_CORE_PACKAGE_NAME,
  sanitizeProperties,
} from "./contracts";
import {
  type AnalyticsEventStore,
  createIndexedDbEventStore,
  createMemoryEventStore,
} from "./event-store";
import {
  dateKey,
  getOrCreateVisitor,
  type StorageLike,
  writeVisitor,
} from "./visitor";

export type AnalyticsPermission = "allowed" | "denied" | "undecided";

export type AnalyticsConfig = {
  project: string;
  endpoint?: string;
  permission?: () => AnalyticsPermission;
  /** @deprecated Event names are discovered automatically after validation. */
  allowedEvents?: readonly string[];
  flushAt?: number;
  flushIntervalMs?: number;
  maxQueueEvents?: number;
  maxQueueAgeMs?: number;
  autoTrackPageViews?: boolean;
  trackAttributes?: boolean;
  storage?: StorageLike;
  transport?: (batch: AnalyticsBatch) => Promise<void>;
  disabled?: boolean;
  respectPrivacySignals?: boolean;
  debug?: boolean;
  now?: () => Date;
  createId?: () => string;
};

export type TrackContext = {
  route?: string;
  referrerHost?: string;
  campaign?: AnalyticsEvent["campaign"];
};

export type AnalyticsClient = {
  init: () => void;
  track: (
    name: string,
    properties?: Record<string, unknown>,
    context?: TrackContext,
  ) => boolean;
  trackPageView: (context?: TrackContext) => boolean;
  flush: () => Promise<void>;
  reset: () => void;
  destroy: () => void;
};

const SDK_VERSION = "0.3.0";
const DEFAULT_FLUSH_AT = 25;
const DEFAULT_FLUSH_INTERVAL_MS = 60_000;
const DEFAULT_MAX_QUEUE_EVENTS = 250;
const DEFAULT_MAX_QUEUE_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_BATCH_EVENTS = 25;
const MAX_BATCH_BYTES = 48 * 1024;
const CLAIM_LEASE_MS = 30_000;

function sanitizeRoute(route?: string) {
  if (!route) return undefined;
  try {
    return new URL(route, "https://logly.invalid").pathname.slice(0, 256);
  } catch {
    return route.split(/[?#]/, 1)[0]?.slice(0, 256);
  }
}

function capped(value: string | undefined, maxLength: number) {
  return value?.slice(0, maxLength);
}

function sanitizeCampaign(campaign?: AnalyticsEvent["campaign"]) {
  if (!campaign) return undefined;
  return {
    source: capped(campaign.source, 100),
    medium: capped(campaign.medium, 100),
    campaign: capped(campaign.campaign, 100),
  };
}

function getBrowserContext(): TrackContext {
  if (typeof window === "undefined") return {};
  const url = new URL(window.location.href);
  let referrerHost: string | undefined;
  try {
    referrerHost = document.referrer
      ? new URL(document.referrer).hostname
      : undefined;
  } catch {
    referrerHost = undefined;
  }
  return {
    route: url.pathname.slice(0, 256),
    referrerHost,
    campaign: {
      source: url.searchParams.get("utm_source") ?? undefined,
      medium: url.searchParams.get("utm_medium") ?? undefined,
      campaign: url.searchParams.get("utm_campaign") ?? undefined,
    },
  };
}

function privacySignalsAllowTracking() {
  if (typeof navigator === "undefined") return true;
  const withGpc = navigator as Navigator & { globalPrivacyControl?: boolean };
  return !withGpc.globalPrivacyControl && navigator.doNotTrack !== "1";
}

function supportsKeepaliveFetch() {
  if (typeof Request === "undefined") return false;
  try {
    return "keepalive" in new Request("https://logly.invalid");
  } catch {
    return false;
  }
}

type TaggedElement = {
  attributes: Iterable<{ name: string; value: string }>;
  closest: (selector: string) => TaggedElement | null;
};

function findTaggedElement(target: EventTarget | null) {
  if (!target || typeof target !== "object" || !("closest" in target)) {
    return null;
  }
  const candidate = target as unknown as TaggedElement;
  return candidate.closest("[data-logly-event]");
}

function readTaggedEvent(element: TaggedElement) {
  let name: string | undefined;
  const properties: Record<string, unknown> = {};
  for (const attribute of element.attributes) {
    if (attribute.name === "data-logly-event") {
      name = attribute.value;
      continue;
    }
    if (!attribute.name.startsWith("data-logly-prop-")) continue;
    const key = attribute.name
      .slice("data-logly-prop-".length)
      .replaceAll("-", "_")
      .slice(0, 64);
    if (/^[a-z][a-z0-9_]*$/.test(key)) properties[key] = attribute.value;
  }
  return name ? { name, properties } : null;
}

type InternalAnalyticsConfig = AnalyticsConfig & {
  eventStore?: AnalyticsEventStore;
};

function createAnalyticsClient(
  config: InternalAnalyticsConfig,
): AnalyticsClient {
  const storage =
    config.storage ??
    (typeof window !== "undefined" ? window.localStorage : undefined);
  const endpoint = config.endpoint ?? "/api/analytics";
  const permission = config.permission ?? (() => "allowed" as const);
  const now = config.now ?? (() => new Date());
  const createId = config.createId ?? (() => crypto.randomUUID());
  const storageKey = `logly:${config.project}:visitor`;
  const flushAt = Math.min(
    MAX_BATCH_EVENTS,
    Math.max(1, config.flushAt ?? DEFAULT_FLUSH_AT),
  );
  const flushIntervalMs = Math.max(
    1_000,
    Math.min(
      DEFAULT_FLUSH_INTERVAL_MS,
      config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
    ),
  );
  const maxQueueEvents = Math.min(
    DEFAULT_MAX_QUEUE_EVENTS,
    Math.max(1, config.maxQueueEvents ?? DEFAULT_MAX_QUEUE_EVENTS),
  );
  const maxQueueAgeMs = Math.min(
    DEFAULT_MAX_QUEUE_AGE_MS,
    Math.max(flushIntervalMs, config.maxQueueAgeMs ?? DEFAULT_MAX_QUEUE_AGE_MS),
  );
  const owner = createId();
  const memoryStore = createMemoryEventStore();
  let eventStore =
    config.eventStore ??
    (typeof indexedDB !== "undefined"
      ? createIndexedDbEventStore(indexedDB)
      : memoryStore);
  let usingFallbackStore = eventStore === memoryStore;
  let pendingWrites = Promise.resolve();
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let flushPromise: Promise<void> | undefined;
  let initialized = false;
  let destroyed = false;
  let lastPageViewRoute: string | undefined;

  const warn = (message: string, error?: unknown) => {
    if (config.debug) console.warn(`[logly] ${message}`, error);
  };

  const runStore = async <T>(
    operation: (store: AnalyticsEventStore) => Promise<T>,
  ): Promise<T> => {
    try {
      return await operation(eventStore);
    } catch (error) {
      if (config.eventStore || usingFallbackStore) throw error;
      warn("IndexedDB unavailable; using memory queue", error);
      eventStore = memoryStore;
      usingFallbackStore = true;
      return operation(eventStore);
    }
  };

  const clearPersistedAnalytics = () => {
    storage?.removeItem(storageKey);
    pendingWrites = pendingWrites
      .then(() => runStore((store) => store.clear(config.project)))
      .catch((error) => warn("failed to clear analytics state", error));
  };

  const isAllowed = () => {
    if (config.disabled || destroyed) return false;
    const decision = permission();
    const privacyAllowed =
      config.respectPrivacySignals === false || privacySignalsAllowTracking();
    if (decision === "denied" || !privacyAllowed) clearPersistedAnalytics();
    return decision === "allowed" && privacyAllowed;
  };

  const defaultTransport = async (batch: AnalyticsBatch) => {
    const body = JSON.stringify(batch);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: supportsKeepaliveFetch(),
      credentials: "same-origin",
    });
    if (!response.ok) {
      throw new Error(`Analytics delivery failed with ${response.status}`);
    }
  };

  const transport = config.transport ?? defaultTransport;

  const scheduleFlush = () => {
    if (flushTimer || destroyed) return;
    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      void flush();
    }, flushIntervalMs);
  };

  const enqueueEvent = (event: AnalyticsEvent) => {
    const enqueuedAt = now().getTime();
    pendingWrites = pendingWrites
      .then(async () => {
        await runStore((store) =>
          store.enqueue(event, enqueuedAt, enqueuedAt + maxQueueAgeMs),
        );
        await runStore((store) =>
          store.prune(config.project, now().getTime(), maxQueueEvents),
        );
      })
      .catch((error) => warn("failed to persist event", error));
    void pendingWrites.then(async () => {
      const [count, bytes] = await Promise.all([
        runStore((store) => store.count(config.project)),
        runStore((store) => store.bytes(config.project)),
      ]);
      if (count >= flushAt || bytes >= MAX_BATCH_BYTES) void flush();
    });
    scheduleFlush();
  };

  const createEvent = (
    name: string,
    properties: Record<string, unknown> = {},
    context: TrackContext = {},
  ) => {
    if (!isAllowed() || !storage) return null;
    if (!eventNameSchema.safeParse(name).success) return null;
    const current = now();
    const visitor = getOrCreateVisitor(storage, storageKey, current, createId);
    const browser = getBrowserContext();
    const event: AnalyticsEvent = {
      eventId: createId(),
      project: config.project,
      name,
      version: 1,
      source: "browser",
      occurredAt: current.toISOString(),
      visitorId: visitor.id,
      route: sanitizeRoute(context.route ?? browser.route),
      referrerHost: capped(context.referrerHost ?? browser.referrerHost, 160),
      campaign: sanitizeCampaign(context.campaign ?? browser.campaign),
      properties: sanitizeProperties(properties),
    };
    enqueueEvent(event);
    return event;
  };

  const deliverClaim = async (eventId?: string) => {
    await pendingWrites;
    await runStore((store) =>
      store.prune(config.project, now().getTime(), maxQueueEvents),
    );
    const events = await runStore((store) =>
      store.claim({
        project: config.project,
        owner,
        now: now().getTime(),
        leaseMs: CLAIM_LEASE_MS,
        limit: eventId ? 1 : MAX_BATCH_EVENTS,
        maxBytes: MAX_BATCH_BYTES,
        eventId,
      }),
    );
    if (!events.length) return 0;
    const ids = events.map((event) => event.eventId);
    const batch: AnalyticsBatch = {
      sentAt: now().toISOString(),
      sdk: { name: LOGLY_CORE_PACKAGE_NAME, version: SDK_VERSION },
      events,
    };
    try {
      await transport(batch);
      await runStore((store) => store.acknowledge(config.project, ids, owner));
      return events.length;
    } catch (error) {
      await runStore((store) => store.release(config.project, ids, owner));
      warn("failed to flush", error);
      return -1;
    }
  };

  const runFlush = async (eventId?: string) => {
    if (!isAllowed()) return;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    if (eventId) {
      await deliverClaim(eventId);
      return;
    }
    while (true) {
      const delivered = await deliverClaim();
      if (delivered <= 0) break;
    }
  };

  const reschedulePendingDelivery = () => {
    void pendingWrites
      .then(() => runStore((store) => store.count(config.project)))
      .then((count) => {
        if (count > 0) scheduleFlush();
      })
      .catch((error) => warn("failed to inspect pending events", error));
  };

  const flush = () => {
    if (flushPromise) return flushPromise;
    flushPromise = runFlush().finally(() => {
      flushPromise = undefined;
      reschedulePendingDelivery();
    });
    return flushPromise;
  };

  const flushEvent = (eventId: string) => {
    if (flushPromise) return flushPromise.then(() => runFlush(eventId));
    flushPromise = runFlush(eventId).finally(() => {
      flushPromise = undefined;
      reschedulePendingDelivery();
    });
    return flushPromise;
  };

  const track = (
    name: string,
    properties: Record<string, unknown> = {},
    context: TrackContext = {},
  ) => Boolean(createEvent(name, properties, context));

  const trackPageView = (context: TrackContext = {}) => {
    const route = sanitizeRoute(context.route ?? getBrowserContext().route);
    if (route && route === lastPageViewRoute) return false;
    const event = createEvent("page_view", {}, { ...context, route });
    if (event) lastPageViewRoute = route;
    return Boolean(event);
  };

  const handleTaggedClick = (event: Event) => {
    const element = findTaggedElement(event.target);
    if (!element) return;
    const tagged = readTaggedEvent(element);
    if (tagged) track(tagged.name, tagged.properties);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") void flush();
  };
  const handlePageExit = () => void flush();
  const handleOnline = () => void flush();

  const addListeners = () => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (config.trackAttributes)
      document.addEventListener("click", handleTaggedClick);
  };

  const removeListeners = () => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    window.removeEventListener("pagehide", handlePageExit);
    window.removeEventListener("online", handleOnline);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.removeEventListener("click", handleTaggedClick);
  };

  const init = () => {
    if (initialized || !isAllowed() || !storage) return;
    initialized = true;
    addListeners();
    scheduleFlush();
    const current = now();
    const visitor = getOrCreateVisitor(storage, storageKey, current, createId);
    const today = dateKey(current);
    if (visitor.lastVisitOn !== today) {
      const firstEver = visitor.lastVisitOn === null;
      const visitKind = visitor.firstSeenOn === today ? "new" : "returning";
      const event = createEvent("site_visit", { visit_kind: visitKind });
      if (event) {
        event.visitKind = visitKind;
        writeVisitor(storage, storageKey, { ...visitor, lastVisitOn: today });
        if (firstEver) void flushEvent(event.eventId);
      }
    }
  };

  return {
    init,
    track,
    trackPageView,
    flush,
    reset: () => {
      lastPageViewRoute = undefined;
      clearPersistedAnalytics();
    },
    destroy: () => {
      destroyed = true;
      if (flushTimer) clearTimeout(flushTimer);
      removeListeners();
    },
  };
}

export function createAnalytics(config: AnalyticsConfig): AnalyticsClient {
  return createAnalyticsClient(config);
}

export function createAnalyticsForTesting(
  config: AnalyticsConfig,
  eventStore: AnalyticsEventStore,
): AnalyticsClient {
  return createAnalyticsClient({ ...config, eventStore });
}
