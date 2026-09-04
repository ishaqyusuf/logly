export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type VisitorState = {
  id: string;
  firstSeenOn: string;
  lastVisitOn: string | null;
};

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function readVisitor(
  storage: StorageLike,
  key: string,
): VisitorState | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as VisitorState;
    if (!value.id || !value.firstSeenOn) return null;
    return value;
  } catch {
    return null;
  }
}

export function getOrCreateVisitor(
  storage: StorageLike,
  key: string,
  now: Date,
  createId: () => string,
): VisitorState {
  const existing = readVisitor(storage, key);
  if (existing) return existing;

  const visitor = {
    id: createId(),
    firstSeenOn: dateKey(now),
    lastVisitOn: null,
  } satisfies VisitorState;
  storage.setItem(key, JSON.stringify(visitor));
  return visitor;
}

export function writeVisitor(
  storage: StorageLike,
  key: string,
  visitor: VisitorState,
) {
  storage.setItem(key, JSON.stringify(visitor));
}

export function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
