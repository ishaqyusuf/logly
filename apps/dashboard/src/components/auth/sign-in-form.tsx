"use client";

import { BrandMark, BrandWordmark, brandColor } from "@logly/ui/brand";
import { Button } from "@logly/ui/button";
import { Input } from "@logly/ui/input";
import { KeyRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { signIn } from "@/lib/auth-client";
import { safeReturnTo } from "@/lib/auth-return-to";
import {
  isPasskeyCancellation,
  passkeySignInMessage,
} from "@/lib/passkey-errors";

export function SignInForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [supportsPasskeys, setSupportsPasskeys] = useState(false);
  const returnTo = searchParams.get("return_to");

  // Conditional UI: offer saved passkeys in the email field's autofill. The
  // pending request is aborted automatically when the button flow starts.
  useEffect(() => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return;
    setSupportsPasskeys(true);
    let active = true;
    const credential = window.PublicKeyCredential;
    void (async () => {
      const conditional =
        (await credential.isConditionalMediationAvailable?.()) ?? false;
      if (!conditional || !active) return;
      const result = await signIn.passkey({ autoFill: true });
      if (!active) return;
      if (result.error) {
        if (!isPasskeyCancellation(result.error)) {
          setError(passkeySignInMessage(result.error));
        }
        return;
      }
      window.location.href = safeReturnTo(returnTo);
    })();
    return () => {
      active = false;
    };
  }, [returnTo]);

  async function handlePasskeySignIn() {
    setError(null);
    setIsPending(true);
    const result = await signIn.passkey();
    if (result.error) {
      setError(passkeySignInMessage(result.error));
      setIsPending(false);
      return;
    }
    window.location.href = safeReturnTo(returnTo);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    const callbackURL = safeReturnTo(searchParams.get("return_to"));

    try {
      const result = await signIn.email({
        callbackURL,
        email,
        password,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Sign-in failed.");
      }
      window.location.href = callbackURL;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
      setIsPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div
          className="mb-8 flex items-center justify-center gap-3"
          style={{ color: brandColor }}
        >
          <BrandMark size={44} />
          <BrandWordmark className="text-[42px]" />
        </div>
        <header className="mb-8 space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Use your operator account to access Logly.
          </p>
        </header>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              autoComplete="username webauthn"
              disabled={isPending}
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              type="email"
              value={email}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Input
              autoComplete="current-password"
              disabled={isPending}
              id="password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="h-10 w-full" disabled={isPending} type="submit">
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        {supportsPasskeys ? (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              className="h-10 w-full"
              disabled={isPending}
              onClick={handlePasskeySignIn}
              type="button"
              variant="outline"
            >
              <KeyRound className="size-4" />
              Sign in with a passkey
            </Button>
          </>
        ) : null}
      </div>
    </main>
  );
}
