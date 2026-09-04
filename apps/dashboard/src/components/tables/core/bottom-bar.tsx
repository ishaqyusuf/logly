"use client";

import { Button } from "@logly/ui/button";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Portal } from "@/components/portal";

export function BottomBar({
  selectedCount,
  onDeselect,
  children,
}: {
  selectedCount: number;
  onDeselect: () => void;
  children: ReactNode;
}) {
  return (
    <Portal>
      <motion.div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex h-12 justify-center md:bottom-6 md:ml-[84px]"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="pointer-events-auto relative h-12 min-w-[min(400px,calc(100vw-24px))] overflow-hidden rounded-xl border shadow-2xl">
          <motion.div
            className="absolute inset-0 bg-background/85 backdrop-blur-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <div className="relative flex h-12 items-center justify-between gap-4 px-2 pl-4">
            <span className="whitespace-nowrap text-sm">
              {selectedCount} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={onDeselect}
              >
                Deselect all
              </Button>
              {children}
            </div>
          </div>
        </div>
      </motion.div>
    </Portal>
  );
}
