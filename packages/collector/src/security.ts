import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isAllowedOrigin(origin: string | null, allowed: string[]) {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  return Boolean(
    normalized &&
      allowed.some((candidate) => normalizeOrigin(candidate) === normalized),
  );
}

export function verifyBatchSignature(
  body: string,
  credential: string,
  signature: string | null,
) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", credential).update(body).digest("hex");
  return safeEqual(expected, signature.toLowerCase());
}

export function getRequiredHashSecret() {
  const secret = process.env.LOGLY_HASH_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "logly-development-hash-secret-not-for-production";
  }
  throw new Error("LOGLY_HASH_SECRET must contain at least 32 characters");
}
