"use client";

import { Button } from "@logly/ui/button";
import { Input } from "@logly/ui/input";
import { format } from "date-fns";
import { KeyRound, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  defaultPasskeyName,
  passkeyRegistrationMessage,
} from "@/lib/passkey-errors";

export function PasskeySettings() {
  const { data: passkeys, isPending, refetch } = authClient.useListPasskeys();
  const [supported, setSupported] = useState(true);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setSupported(Boolean(window.PublicKeyCredential));
    setName(defaultPasskeyName(navigator.userAgent));
  }, []);

  async function addPasskey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) return;
    setAdding(true);
    setError(null);
    setNotice(null);
    const result = await authClient.passkey.addPasskey({
      name: name.trim() || undefined,
    });
    setAdding(false);
    if (result.error) {
      setError(passkeyRegistrationMessage(result.error));
      return;
    }
    setNotice("Passkey added. You can use it on the sign-in page.");
    refetch();
  }

  async function removePasskey(id: string, label: string) {
    if (removingId) return;
    if (!window.confirm(`Remove the passkey “${label}”?`)) return;
    setRemovingId(id);
    setError(null);
    setNotice(null);
    const result = await authClient.passkey.deletePasskey({ id });
    setRemovingId(null);
    if (result.error) {
      setError("Could not remove the passkey. Try again.");
      return;
    }
    setNotice("Passkey removed.");
    refetch();
  }

  return (
    <section className="rounded-xl border bg-white shadow-soft">
      <div className="border-b p-5">
        <h3 className="text-sm font-semibold">Passkeys</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Sign in with your device’s fingerprint, face or security key instead
          of a password. Passkeys belong to your operator account and work only
          on this dashboard’s address.
        </p>
      </div>
      <div className="space-y-4 p-5">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading passkeys…</p>
        ) : passkeys && passkeys.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {passkeys.map((item) => {
              const label = item.name || "Unnamed passkey";
              return (
                <li className="flex items-center gap-3 p-3" key={item.id}>
                  <div className="grid size-8 place-items-center rounded-lg bg-[#edf3ee] text-[#347b56]">
                    <KeyRound className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.createdAt
                        ? `Added ${format(new Date(item.createdAt), "d MMM yyyy")}`
                        : "Added"}
                      {item.backedUp ? " · Synced" : ""}
                    </p>
                  </div>
                  <Button
                    aria-label={`Remove ${label}`}
                    disabled={removingId !== null}
                    onClick={() => removePasskey(item.id, label)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="size-4" />
                    {removingId === item.id ? "Removing…" : "Remove"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No passkeys yet. Your password still works either way.
          </p>
        )}
        {supported ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={addPasskey}
          >
            <Input
              aria-label="Passkey name"
              disabled={adding}
              maxLength={64}
              onChange={(event) => setName(event.target.value)}
              placeholder="Passkey name"
              value={name}
            />
            <Button className="shrink-0" disabled={adding} type="submit">
              <KeyRound className="size-4" />
              {adding ? "Waiting for device…" : "Add passkey"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            This browser does not support passkeys.
          </p>
        )}
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="text-sm text-[#347b56]" role="status">
            {notice}
          </p>
        ) : null}
      </div>
    </section>
  );
}
