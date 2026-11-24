import { describe, expect, test } from "bun:test";
import {
  originMatchesRpID,
  resolvePasskeyRelyingParty,
} from "./passkey-config";

describe("resolvePasskeyRelyingParty", () => {
  test("derives the RP ID and origin from the production base URL", () => {
    expect(
      resolvePasskeyRelyingParty("https://logly-chi.vercel.app", {}),
    ).toEqual({
      rpID: "logly-chi.vercel.app",
      rpName: "Logly",
      origin: ["https://logly-chi.vercel.app"],
    });
  });

  test("uses the local Portless host by default", () => {
    const rp = resolvePasskeyRelyingParty("https://logly.localhost", {
      BETTER_AUTH_TRUSTED_ORIGINS: "https://logly.localhost",
    });
    expect(rp.rpID).toBe("logly.localhost");
    expect(rp.origin).toEqual(["https://logly.localhost"]);
  });

  test("an explicit RP ID keeps only origins that belong to it", () => {
    const rp = resolvePasskeyRelyingParty("http://localhost:4201", {
      PASSKEY_RP_ID: "localhost",
      BETTER_AUTH_TRUSTED_ORIGINS:
        "http://localhost:4101, https://logly-chi.vercel.app",
      PASSKEY_ORIGINS: "http://localhost:4201/, not a url",
      PASSKEY_RP_NAME: "Logly local",
    });
    expect(rp).toEqual({
      rpID: "localhost",
      rpName: "Logly local",
      origin: ["http://localhost:4201", "http://localhost:4101"],
    });
  });

  test("falls back to localhost without a base URL", () => {
    expect(resolvePasskeyRelyingParty(undefined, {}).rpID).toBe("localhost");
  });
});

describe("originMatchesRpID", () => {
  test("accepts the host and its subdomains only", () => {
    expect(originMatchesRpID("https://a.example.com", "example.com")).toBe(
      true,
    );
    expect(originMatchesRpID("https://example.com:8443", "example.com")).toBe(
      true,
    );
    expect(originMatchesRpID("https://badexample.com", "example.com")).toBe(
      false,
    );
  });
});
