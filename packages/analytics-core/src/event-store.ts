import type { AnalyticsEvent } from "./contracts";

export type EventClaimOptions = {
  project: string;
  owner: string;
  now: number;
  leaseMs: number;
  limit: number;
  maxBytes: number;
  eventId?: string;
};

export type AnalyticsEventStore = {
  enqueue: (
    event: AnalyticsEvent,
    enqueuedAt: number,
    expiresAt: number,
  ) => Promise<void>;
  claim: (options: EventClaimOptions) => Promise<AnalyticsEvent[]>;
  acknowledge: (
    project: string,
    eventIds: readonly string[],
    owner: string,
  ) => Promise<void>;
  release: (
    project: string,
    eventIds: readonly string[],
    owner: string,
  ) => Promise<void>;
  prune: (project: string, now: number, maxEvents: number) => Promise<void>;
  count: (project: string) => Promise<number>;
  bytes: (project: string) => Promise<number>;
  clear: (project: string) => Promise<void>;
};

type StoredEvent = {
  key: string;
  project: string;
  event: AnalyticsEvent;
  enqueuedAt: number;
  expiresAt: number;
  claimOwner?: string;
  claimUntil?: number;
};

const DATABASE_NAME = "logly-analytics";
const DATABASE_VERSION = 1;
const EVENT_STORE = "events";
const PROJECT_ENQUEUED_INDEX = "project_enqueued";
const encoder = new TextEncoder();

function eventKey(project: string, eventId: string) {
  return `${project}:${eventId}`;
}

function eventBytes(event: AnalyticsEvent) {
  return encoder.encode(JSON.stringify(event)).byteLength;
}

function canClaim(record: StoredEvent, now: number) {
  return !record.claimUntil || record.claimUntil <= now;
}

export function createMemoryEventStore(): AnalyticsEventStore {
  const records = new Map<string, StoredEvent>();

  return {
    enqueue: async (event, enqueuedAt, expiresAt) => {
      records.set(eventKey(event.project, event.eventId), {
        key: eventKey(event.project, event.eventId),
        project: event.project,
        event,
        enqueuedAt,
        expiresAt,
      });
    },
    claim: async (options) => {
      const claimed: AnalyticsEvent[] = [];
      let bytes = 256;
      const candidates = [...records.values()]
        .filter(
          (record) =>
            record.project === options.project &&
            (!options.eventId || record.event.eventId === options.eventId) &&
            record.expiresAt > options.now &&
            canClaim(record, options.now),
        )
        .sort((left, right) => left.enqueuedAt - right.enqueuedAt);

      for (const record of candidates) {
        if (claimed.length >= options.limit) break;
        const size = eventBytes(record.event);
        if (claimed.length > 0 && bytes + size > options.maxBytes) break;
        bytes += size;
        record.claimOwner = options.owner;
        record.claimUntil = options.now + options.leaseMs;
        claimed.push(record.event);
      }
      return claimed;
    },
    acknowledge: async (project, eventIds, owner) => {
      for (const eventId of eventIds) {
        const key = eventKey(project, eventId);
        const record = records.get(key);
        if (record?.claimOwner === owner) records.delete(key);
      }
    },
    release: async (project, eventIds, owner) => {
      for (const eventId of eventIds) {
        const record = records.get(eventKey(project, eventId));
        if (record?.claimOwner !== owner) continue;
        delete record.claimOwner;
        delete record.claimUntil;
      }
    },
    prune: async (project, now, maxEvents) => {
      const projectRecords = [...records.values()]
        .filter((record) => record.project === project)
        .sort((left, right) => left.enqueuedAt - right.enqueuedAt);
      for (const record of projectRecords) {
        if (record.expiresAt <= now) records.delete(record.key);
      }
      const remaining = projectRecords.filter((record) =>
        records.has(record.key),
      );
      for (const record of remaining.slice(
        0,
        Math.max(0, remaining.length - maxEvents),
      )) {
        records.delete(record.key);
      }
    },
    count: async (project) =>
      [...records.values()].filter((record) => record.project === project)
        .length,
    bytes: async (project) =>
      [...records.values()]
        .filter((record) => record.project === project)
        .reduce((total, record) => total + eventBytes(record.event), 256),
    clear: async (project) => {
      for (const record of records.values()) {
        if (record.project === project) records.delete(record.key);
      }
    },
  };
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function openDatabase(factory: IDBFactory) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(EVENT_STORE)
        ? request.transaction?.objectStore(EVENT_STORE)
        : database.createObjectStore(EVENT_STORE, { keyPath: "key" });
      if (store && !store.indexNames.contains(PROJECT_ENQUEUED_INDEX)) {
        store.createIndex(PROJECT_ENQUEUED_INDEX, ["project", "enqueuedAt"]);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open IndexedDB"));
    request.onblocked = () =>
      reject(new Error("IndexedDB upgrade was blocked"));
  });
}

function projectRange(project: string) {
  return IDBKeyRange.bound([project, 0], [project, Number.MAX_SAFE_INTEGER]);
}

export function createIndexedDbEventStore(
  factory: IDBFactory = indexedDB,
): AnalyticsEventStore {
  const database = openDatabase(factory);

  return {
    enqueue: async (event, enqueuedAt, expiresAt) => {
      const db = await database;
      const transaction = db.transaction(EVENT_STORE, "readwrite");
      transaction.objectStore(EVENT_STORE).put({
        key: eventKey(event.project, event.eventId),
        project: event.project,
        event,
        enqueuedAt,
        expiresAt,
      } satisfies StoredEvent);
      await transactionDone(transaction);
    },
    claim: async (options) => {
      const db = await database;
      const transaction = db.transaction(EVENT_STORE, "readwrite");
      const store = transaction.objectStore(EVENT_STORE);
      const claimed: AnalyticsEvent[] = [];
      let bytes = 256;
      if (options.eventId) {
        const record = (await requestResult(
          store.get(eventKey(options.project, options.eventId)),
        )) as StoredEvent | undefined;
        if (
          record &&
          record.expiresAt > options.now &&
          canClaim(record, options.now)
        ) {
          record.claimOwner = options.owner;
          record.claimUntil = options.now + options.leaseMs;
          store.put(record);
          claimed.push(record.event);
        }
        await transactionDone(transaction);
        return claimed;
      }
      const index = store.index(PROJECT_ENQUEUED_INDEX);
      const request = index.openCursor(projectRange(options.project));

      await new Promise<void>((resolve, reject) => {
        request.onerror = () =>
          reject(
            request.error ?? new Error("Unable to claim analytics events"),
          );
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor || claimed.length >= options.limit) {
            resolve();
            return;
          }
          const record = cursor.value as StoredEvent;
          const size = eventBytes(record.event);
          if (
            record.expiresAt > options.now &&
            canClaim(record, options.now) &&
            (claimed.length === 0 || bytes + size <= options.maxBytes)
          ) {
            bytes += size;
            record.claimOwner = options.owner;
            record.claimUntil = options.now + options.leaseMs;
            cursor.update(record);
            claimed.push(record.event);
          }
          cursor.continue();
        };
      });
      await transactionDone(transaction);
      return claimed;
    },
    acknowledge: async (project, eventIds, owner) => {
      const db = await database;
      const transaction = db.transaction(EVENT_STORE, "readwrite");
      const store = transaction.objectStore(EVENT_STORE);
      for (const eventId of eventIds) {
        const key = eventKey(project, eventId);
        const request = store.get(key);
        request.onsuccess = () => {
          const record = request.result as StoredEvent | undefined;
          if (record?.claimOwner === owner) store.delete(key);
        };
      }
      await transactionDone(transaction);
    },
    release: async (project, eventIds, owner) => {
      const db = await database;
      const transaction = db.transaction(EVENT_STORE, "readwrite");
      const store = transaction.objectStore(EVENT_STORE);
      for (const eventId of eventIds) {
        const request = store.get(eventKey(project, eventId));
        request.onsuccess = () => {
          const record = request.result as StoredEvent | undefined;
          if (record?.claimOwner !== owner) return;
          delete record.claimOwner;
          delete record.claimUntil;
          store.put(record);
        };
      }
      await transactionDone(transaction);
    },
    prune: async (project, now, maxEvents) => {
      const db = await database;
      const transaction = db.transaction(EVENT_STORE, "readwrite");
      const store = transaction.objectStore(EVENT_STORE);
      const request = store
        .index(PROJECT_ENQUEUED_INDEX)
        .openCursor(projectRange(project));
      const remaining: StoredEvent[] = [];
      await new Promise<void>((resolve, reject) => {
        request.onerror = () =>
          reject(
            request.error ?? new Error("Unable to prune analytics events"),
          );
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          const record = cursor.value as StoredEvent;
          if (record.expiresAt <= now) cursor.delete();
          else remaining.push(record);
          cursor.continue();
        };
      });
      for (const record of remaining.slice(
        0,
        Math.max(0, remaining.length - maxEvents),
      )) {
        store.delete(record.key);
      }
      await transactionDone(transaction);
    },
    count: async (project) => {
      const db = await database;
      const transaction = db.transaction(EVENT_STORE, "readonly");
      const count = await requestResult(
        transaction
          .objectStore(EVENT_STORE)
          .index(PROJECT_ENQUEUED_INDEX)
          .count(projectRange(project)),
      );
      await transactionDone(transaction);
      return count;
    },
    bytes: async (project) => {
      const db = await database;
      const transaction = db.transaction(EVENT_STORE, "readonly");
      const request = transaction
        .objectStore(EVENT_STORE)
        .index(PROJECT_ENQUEUED_INDEX)
        .openCursor(projectRange(project));
      let bytes = 256;
      await new Promise<void>((resolve, reject) => {
        request.onerror = () =>
          reject(request.error ?? new Error("Unable to size analytics events"));
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          bytes += eventBytes((cursor.value as StoredEvent).event);
          cursor.continue();
        };
      });
      await transactionDone(transaction);
      return bytes;
    },
    clear: async (project) => {
      const db = await database;
      const transaction = db.transaction(EVENT_STORE, "readwrite");
      const request = transaction
        .objectStore(EVENT_STORE)
        .index(PROJECT_ENQUEUED_INDEX)
        .openKeyCursor(projectRange(project));
      await new Promise<void>((resolve, reject) => {
        request.onerror = () =>
          reject(
            request.error ?? new Error("Unable to clear analytics events"),
          );
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          cursor.delete();
          cursor.continue();
        };
      });
      await transactionDone(transaction);
    },
  };
}
