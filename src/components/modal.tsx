"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { NewProjectForm } from "./new-project-form";
import type { ProjectType } from "@/lib/project-types";

/**
 * Route modal (used with an intercepting route): Esc, backdrop click or `close()` go back.
 * Locks page scroll and restores focus to whatever opened it.
 */
export function RouteModal({
  children,
  label,
}: {
  children: (close: () => void) => React.ReactNode;
  label: string;
}) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => router.back(), [router]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      // Minimal focus trap: keep Tab inside the dialog.
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([type=hidden]), textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 backdrop-blur-[2px] sm:p-8 sm:pt-[6vh]"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[880px] flex-col rounded-xl border border-border bg-background shadow-2xl sm:max-h-[88dvh]"
      >
        {children(close)}
      </div>
    </div>
  );
}

// ---- New project modal (client wrapper so server pages can render it) ----

export function NewProjectModal({ user, initialType }: { user: { name: string }; initialType?: ProjectType }) {
  return (
    <RouteModal label="New project">{(close) => <NewProjectForm user={user} variant="modal" onClose={close} initialType={initialType} />}</RouteModal>
  );
}
