import type { ReactNode } from "react";

export function ScrollableContent({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-6 md:px-8 md:pb-10">
      {children}
    </main>
  );
}
