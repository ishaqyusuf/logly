/**
 * Email channel. One transport interface with two implementations: Resend
 * (production only) and a disabled transport that sends nothing. Callers
 * never see provider details; tests inject a fake transport.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Extra headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
  /**
   * Provider idempotency key. Resend drops a repeated key for 24 hours, so a
   * retried claim cannot deliver the same message twice.
   */
  idempotencyKey?: string;
};

export type EmailSendResult =
  | { status: "sent"; id: string | null }
  | { status: "failed"; error: string; retryable: boolean };

export type EmailTransport = {
  /** False when email is not configured for this environment. */
  readonly enabled: boolean;
  readonly reason?: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
};

export type EmailEnvironment = Record<string, string | undefined>;

export const RESEND_ENDPOINT = "https://api.resend.com/emails";
/** Bound on one provider call so a slow provider cannot stall the job. */
export const EMAIL_SEND_TIMEOUT_MS = 10_000;
const MAX_ERROR_LENGTH = 300;

export function disabledTransport(reason: string): EmailTransport {
  return {
    enabled: false,
    reason,
    async send() {
      return { status: "failed", error: reason, retryable: false };
    },
  };
}

export function resendTransport(input: {
  apiKey: string;
  from: string;
  replyTo?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): EmailTransport {
  const request = input.fetch ?? fetch;
  return {
    enabled: true,
    async send(message) {
      const headers: Record<string, string> = {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      };
      if (message.idempotencyKey)
        headers["idempotency-key"] = message.idempotencyKey;
      try {
        const response = await request(RESEND_ENDPOINT, {
          method: "POST",
          headers,
          body: JSON.stringify({
            from: input.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
            headers: message.headers,
            ...(input.replyTo ? { reply_to: input.replyTo } : {}),
          }),
          signal: AbortSignal.timeout(input.timeoutMs ?? EMAIL_SEND_TIMEOUT_MS),
        });
        const body = (await response.json().catch(() => ({}))) as {
          id?: string;
          message?: string;
          name?: string;
        };
        if (response.ok) return { status: "sent", id: body.id ?? null };
        return {
          status: "failed",
          error: `resend ${response.status}: ${String(body.message ?? body.name ?? "error").slice(0, MAX_ERROR_LENGTH)}`,
          // 4xx (bad address, auth, validation) will fail again; 429 and 5xx may not.
          retryable: response.status === 429 || response.status >= 500,
        };
      } catch (cause) {
        return {
          status: "failed",
          error: String(cause instanceof Error ? cause.message : cause).slice(
            0,
            MAX_ERROR_LENGTH,
          ),
          retryable: true,
        };
      }
    },
  };
}

/**
 * Transport for this environment. Email is sent only from a Vercel
 * production deployment with `RESEND_API_KEY` and `EMAIL_FROM` set. Local
 * development and preview deployments always get the disabled transport, so
 * they can never reach real recipients.
 */
export function emailTransportFromEnv(
  env: EmailEnvironment = process.env,
  options: { fetch?: typeof fetch } = {},
): EmailTransport {
  if (env.VERCEL_ENV !== "production")
    return disabledTransport(
      "Email is sent only from the production deployment",
    );
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from)
    return disabledTransport("RESEND_API_KEY and EMAIL_FROM are not set");
  return resendTransport({
    apiKey,
    from,
    replyTo: env.EMAIL_REPLY_TO?.trim() || undefined,
    fetch: options.fetch,
  });
}
