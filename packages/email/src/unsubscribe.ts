import { createHmac, timingSafeEqual } from "node:crypto";

export type EmailSubscriptionKind = "digest" | "alerts";

export type UnsubscribeClaim = {
  subscriptionId: string;
  kind: EmailSubscriptionKind;
};

const VERSION = "u1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Unsubscribe links are signed with a key derived from `BETTER_AUTH_SECRET`,
 * so no new secret is needed and rotating the auth secret revokes old links.
 * The token names a subscription row and kind, never an email address.
 */
export function unsubscribeKey(authSecret: string) {
  return createHmac("sha256", authSecret)
    .update("logly-email-unsubscribe-v1")
    .digest();
}

function sign(key: Buffer, payload: string) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createUnsubscribeToken(key: Buffer, claim: UnsubscribeClaim) {
  const payload = `${VERSION}.${claim.subscriptionId}.${claim.kind}`;
  return `${payload}.${sign(key, payload)}`;
}

export function verifyUnsubscribeToken(
  key: Buffer,
  token: string | null | undefined,
): UnsubscribeClaim | null {
  if (!token || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, subscriptionId, kind, signature] = parts as [
    string,
    string,
    string,
    string,
  ];
  if (version !== VERSION || !UUID.test(subscriptionId)) return null;
  if (kind !== "digest" && kind !== "alerts") return null;
  const expected = Buffer.from(
    sign(key, `${version}.${subscriptionId}.${kind}`),
  );
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  return { subscriptionId, kind };
}
