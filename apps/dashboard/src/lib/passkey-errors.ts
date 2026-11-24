type PasskeyError = { code?: string | null; message?: string | null } | null;

/**
 * The passkey client reports a dismissed prompt or an aborted ceremony as
 * `AUTH_CANCELLED` or a `@simplewebauthn/browser` `ERROR_*` code. Server
 * verification failures use other codes and must stay visible.
 */
export function isPasskeyCancellation(error: PasskeyError) {
  const code = error?.code ?? "";
  return (
    code === "AUTH_CANCELLED" ||
    code === "REGISTRATION_CANCELLED" ||
    code === "ERROR_CEREMONY_ABORTED" ||
    code === "ERROR_PASSKEY_AUTOFILL_ABORTED" ||
    // NotAllowedError: the prompt was dismissed or timed out.
    code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY"
  );
}

/**
 * True when the browser ceremony failed before anything reached the server.
 * Autofill (conditional UI) stays silent on these: the operator never asked
 * for a passkey prompt, and some browsers reject it immediately.
 */
export function isBrowserPasskeyFailure(error: PasskeyError) {
  const code = error?.code ?? "";
  return code === "AUTH_CANCELLED" || code.startsWith("ERROR_");
}

export function passkeySignInMessage(error: PasskeyError) {
  if (!error) return null;
  if (isPasskeyCancellation(error)) {
    return "Passkey sign-in was cancelled.";
  }
  if (
    error.code === "ERROR_INVALID_DOMAIN" ||
    error.code === "ERROR_INVALID_RP_ID"
  ) {
    return "Passkeys are not available on this address.";
  }
  return "That passkey could not sign you in. Try again or use your password.";
}

export function passkeyRegistrationMessage(error: PasskeyError) {
  if (!error) return null;
  if (isPasskeyCancellation(error)) return "Passkey setup was cancelled.";
  if (error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
    return "This device already has a passkey for your account.";
  }
  return "Could not add the passkey. Try again.";
}

/** A readable default label, e.g. "Chrome on macOS". */
export function defaultPasskeyName(userAgent: string) {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";
  const platform = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X|Macintosh/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  return platform ? `${browser} on ${platform}` : browser;
}
