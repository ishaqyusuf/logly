import { describe, expect, test } from "bun:test";
import {
  defaultPasskeyName,
  isBrowserPasskeyFailure,
  isPasskeyCancellation,
  passkeyRegistrationMessage,
  passkeySignInMessage,
} from "./passkey-errors";

describe("passkey errors", () => {
  test("treats dismissed and aborted ceremonies as cancellations", () => {
    expect(isPasskeyCancellation({ code: "AUTH_CANCELLED" })).toBe(true);
    expect(isPasskeyCancellation({ code: "ERROR_CEREMONY_ABORTED" })).toBe(
      true,
    );
    expect(
      isPasskeyCancellation({ code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY" }),
    ).toBe(true);
    expect(isPasskeyCancellation({ code: "PASSKEY_NOT_FOUND" })).toBe(false);
    expect(isPasskeyCancellation(null)).toBe(false);
  });

  test("separates browser ceremony failures from server failures", () => {
    expect(isBrowserPasskeyFailure({ code: "AUTH_CANCELLED" })).toBe(true);
    expect(isBrowserPasskeyFailure({ code: "ERROR_INVALID_DOMAIN" })).toBe(
      true,
    );
    expect(isBrowserPasskeyFailure({ code: "PASSKEY_NOT_FOUND" })).toBe(false);
    expect(isBrowserPasskeyFailure(null)).toBe(false);
  });

  test("keeps server failures distinct from cancellations", () => {
    expect(passkeySignInMessage(null)).toBeNull();
    expect(passkeySignInMessage({ code: "AUTH_CANCELLED" })).toBe(
      "Passkey sign-in was cancelled.",
    );
    expect(passkeySignInMessage({ code: "PASSKEY_NOT_FOUND" })).toContain(
      "could not sign you in",
    );
    expect(
      passkeyRegistrationMessage({
        code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
      }),
    ).toBe("This device already has a passkey for your account.");
  });

  test("names passkeys from the user agent", () => {
    expect(
      defaultPasskeyName(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
      ),
    ).toBe("Chrome on macOS");
    expect(
      defaultPasskeyName(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iOS");
    expect(defaultPasskeyName("")).toBe("Browser");
  });
});
