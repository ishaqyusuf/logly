"use client";

import { Button } from "@logly/ui/button";
import { Input } from "@logly/ui/input";
import { Activity } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { signIn } from "@/lib/auth-client";
import { safeReturnTo } from "@/lib/auth-return-to";

export function SignInForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

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
        <div className="mb-8 flex justify-center">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#17201b] text-white shadow-soft">
            <Activity className="h-5 w-5" />
          </div>
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
              autoComplete="email"
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
      </div>
    </main>
  );
}
