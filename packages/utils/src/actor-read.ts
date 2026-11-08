export type ActorReadContext = { actorId?: string | null };
export type ActorReadQuery = { actor?: string };

export function parseActorReadQuery(value?: string | null): ActorReadQuery {
  if (!value) return {};
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error("Invalid event actor");
  return { actor: value };
}

export function actorReadFields(event: ActorReadContext): ActorReadContext {
  return { actorId: event.actorId ?? null };
}

export function matchesActorRead(
  event: ActorReadContext,
  query: ActorReadQuery,
) {
  return !query.actor || event.actorId === query.actor;
}
