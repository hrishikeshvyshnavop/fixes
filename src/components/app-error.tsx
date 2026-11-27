"use client";

import { useEffect } from "react";

const RELOAD_KEY = "fixes:chunk-reload";

/** True for errors caused by a stale build (old tab / server restarted / two dev servers). */
export function isChunkError(error: Error) {
  return /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    `${error?.name} ${error?.message}`,
  );
}

/**
 * Shared error UI. Stale-chunk errors reload once automatically (guarded so it can't loop);
 * anything else shows the real message so it can be reported.
 */
export function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunk = isChunkError(error);

  useEffect(() => {
    console.error(error);
    if (!chunk) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      /* storage blocked: fall through to the manual button */
    }
  }, [error, chunk]);

  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="text-base font-semibold">
          {chunk ? "Fixes was updated" : "Something went wrong"}
        </h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {chunk
            ? "This page was built from files that have since changed. Reloading picks up the new version."
            : "The page hit an error. Try again; if it keeps happening, share the message below."}
        </p>
        {!chunk && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md border border-border bg-muted px-3 py-2 text-left font-mono text-xs whitespace-pre-wrap text-muted-foreground">
            {error.message || String(error)}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        )}
        <div className="mt-5 flex justify-center gap-2">
          {!chunk && (
            <button
              onClick={reset}
              className="inline-flex h-8 items-center rounded-md border border-border px-3 text-[13px] font-medium hover:bg-accent"
            >
              Try again
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
