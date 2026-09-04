"use client";

import { Button } from "@logly/ui/button";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";

export function SignOutButton({ label }: { label: string }) {
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    setIsPending(true);
    const result = await signOut();
    if (result.error) {
      setIsPending(false);
      return;
    }
    window.location.href = "/sign-in";
  }

  return (
    <Button
      aria-label={`Sign out ${label}`}
      className="h-9 w-9 rounded-full border bg-white p-0 text-xs font-semibold text-[#6f6b63]"
      disabled={isPending}
      onClick={handleSignOut}
      title={`Sign out ${label}`}
      type="button"
      variant="outline"
    >
      {isPending ? "…" : <LogOut className="h-4 w-4" />}
    </Button>
  );
}
