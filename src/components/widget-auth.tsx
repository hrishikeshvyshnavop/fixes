"use client";

import { useEffect, useState } from "react";
import { completeWidgetSignIn, type WidgetSignInResult } from "@/app/widget-auth-actions";
import { authClient } from "@/lib/auth-client";

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.75 12 2.75 6.89 2.75 2.75 6.89 2.75 12s4.14 9.25 9.25 9.25c5.34 0 8.88-3.75 8.88-9.04 0-.61-.07-1.07-.15-1.53z"
      />
    </svg>
  );
}

const btn =
  "flex h-11 w-full items-center justify-center gap-2.5 rounded-lg text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60";

/** "Continue with Google". With `switchAccount`, signs the current session out first. */
export function GoogleSignIn({
  returnTo,
  switchAccount = false,
  label = "Continue with Google",
}: {
  returnTo: string;
  switchAccount?: boolean;
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setPending(true);
    setError(null);
    try {
      if (switchAccount) await authClient.signOut();
      const sep = returnTo.includes("?") ? "&" : "?";
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: returnTo,
        errorCallbackURL: `${returnTo}${sep}error=google_failed`,
      });
      if (error) throw error;
    } catch (e) {
      console.error("[widget google]", e);
      setError("Google sign-in didn't start. Please try again.");
      setPending(false);
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className={`${btn} ${switchAccount ? "border border-border bg-background hover:bg-accent" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
      >
        <GoogleG />
        {pending ? "Redirecting to Google…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

/** Final step: hand the sign-in back to the widget, then close the popup. */
export function CompleteWidgetSignIn({ projectKey, origin, nonce }: { projectKey: string; origin: string; nonce: string }) {
  const [result, setResult] = useState<WidgetSignInResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    completeWidgetSignIn(projectKey, origin, nonce)
      .catch(() => ({ ok: false as const, error: "Something went wrong. Please try again." }))
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        if (r.ok) setTimeout(() => window.close(), 900);
      });
    return () => {
      cancelled = true;
    };
  }, [projectKey, origin, nonce]);

  if (!result) return <p>Finishing sign-in…</p>;
  if (!result.ok)
    return (
      <p role="alert" className="text-destructive">
        {result.error}
      </p>
    );
  return (
    <p>
      Signed in as <span className="font-medium text-foreground">{result.name}</span>. You can close this window and go back to the
      site.
    </p>
  );
}
