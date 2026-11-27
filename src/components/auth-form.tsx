"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { login, signup, type FormState } from "@/app/auth-actions";
import { authClient } from "@/lib/auth-client";
import { input } from "./styles";

type Method = "google" | "email" | "sso" | "passkey";
const LAST_COOKIE = "pp_last_login"; // remembers the last sign-in method on this browser

const ERRORS: Record<string, string> = {
  google_failed: "Google sign-in didn't complete. Please try again.",
};

const noopSubscribe = () => () => {};

function readLast(): Method | null {
  const m = document.cookie.match(/(?:^|; )pp_last_login=([^;]+)/)?.[1] as Method | undefined;
  return m && m in LABEL ? m : null;
}
const LABEL: Record<Method, string> = { google: "Google", email: "email", sso: "SAML SSO", passkey: "a passkey" };

function GoogleG({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.75 12 2.75 6.89 2.75 2.75 6.89 2.75 12s4.14 9.25 9.25 9.25c5.34 0 8.88-3.75 8.88-9.04 0-.61-.07-1.07-.15-1.53z"
      />
    </svg>
  );
}

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center bg-primary font-bold text-primary-foreground shadow-sm"
      style={{ width: size, height: size, borderRadius: `${size / 2}px ${size / 2}px ${size / 2}px ${size / 7}px`, fontSize: size * 0.42 }}
    >
      F
    </span>
  );
}

// Tall, full-width option buttons like the reference.
const optionBase =
  "relative flex h-12 w-full items-center justify-center gap-2.5 rounded-lg text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60";
const optionPrimary = `${optionBase} bg-primary text-primary-foreground shadow-xs hover:bg-primary/90`;
const optionOutline = `${optionBase} border border-border bg-background shadow-xs hover:bg-accent dark:bg-input/30 dark:hover:bg-input/50`;

export function AuthForm({
  mode,
  next,
  email: presetEmail,
  googleEnabled = true,
  error,
}: {
  mode: "login" | "signup";
  next?: string;
  email?: string;
  googleEnabled?: boolean;
  error?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? login : signup, undefined);
  // Invite links prefill the email, so skip straight to the form.
  const [step, setStep] = useState<"choose" | "email">(presetEmail ? "email" : "choose");
  const last = useSyncExternalStore(noopSubscribe, readLast, () => null);
  const [notice, setNotice] = useState<Method | null>(null);
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  const email = state?.fields?.email ?? presetEmail ?? "";
  const verb = mode === "login" ? "Log in" : "Sign up";

  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const google = async () => {
    setGooglePending(true);
    setGoogleError(null);
    document.cookie = `${LAST_COOKIE}=google; path=/; max-age=31536000; samesite=lax`;
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: next ?? "/",
        errorCallbackURL: `/${mode}?error=google_failed`,
      });
      if (error) throw error;
    } catch (e) {
      console.error("[google]", e);
      setGoogleError(ERRORS.google_failed);
      setGooglePending(false);
    }
  };
  const googleFirst = googleEnabled && last === "google";
  const urlError = googleError ?? (error ? (ERRORS[error] ?? "Sign-in failed. Please try again.") : null);

  const unavailable = (m: Method) => {
    setNotice(m);
  };

  return (
    <div className="mx-auto w-full max-w-[340px] text-center">
      <div className="flex justify-center">
        <Logo />
      </div>
      <h1 className="mt-8 text-[22px] font-medium tracking-tight">
        {mode === "login" ? "Log in to Fixes" : "Create your Fixes account"}
      </h1>

      {step === "choose" ? (
        <div className="mt-8">
          {urlError && (
            <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              {urlError}
            </p>
          )}
          {googleFirst ? (
            <button type="button" onClick={google} disabled={googlePending} className={optionPrimary}>
              <GoogleG />
              {googlePending ? "Redirecting to Google…" : "Continue with Google"}
            </button>
          ) : (
            <button type="button" className={optionPrimary} onClick={() => setStep("email")}>
              <Mail size={17} />
              Continue with email
            </button>
          )}
          {mode === "login" && last && (
            <p className="mt-3 text-[13px] text-muted-foreground">You used {LABEL[last]} to log in last time</p>
          )}

          <div className={`space-y-3 ${mode === "login" && last ? "mt-6" : "mt-3"}`}>
            {googleFirst ? (
              <button type="button" className={optionOutline} onClick={() => setStep("email")}>
                <Mail size={17} className="text-muted-foreground" />
                Continue with email
              </button>
            ) : googleEnabled ? (
              <button type="button" onClick={google} disabled={googlePending} className={optionOutline}>
                <GoogleG />
                {googlePending ? "Redirecting to Google…" : "Continue with Google"}
              </button>
            ) : (
              <button type="button" className={optionOutline} onClick={() => unavailable("google")}>
                <GoogleG />
                Continue with Google
              </button>
            )}
            <button type="button" className={optionOutline} onClick={() => unavailable("sso")}>
              <ShieldCheck size={17} className="text-muted-foreground" />
              Continue with SAML SSO
            </button>
            {mode === "login" && (
              <button type="button" className={optionOutline} onClick={() => unavailable("passkey")}>
                <KeyRound size={17} className="text-muted-foreground" />
                Log in with Passkey
              </button>
            )}
          </div>

          {notice && (
            <p role="status" className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-[13px] text-muted-foreground">
              {notice === "google" ? "Google sign-in" : notice === "sso" ? "SAML SSO" : "Passkey sign-in"} isn&apos;t set up on this
              Fixes server yet.{" "}
              <button type="button" onClick={() => setStep("email")} className="font-medium text-foreground underline underline-offset-4">
                Use email
              </button>{" "}
              for now.
            </p>
          )}
        </div>
      ) : (
        <form
          action={action}
          onSubmit={() => {
            document.cookie = `${LAST_COOKIE}=email; path=/; max-age=31536000; samesite=lax`;
          }}
          className="mt-8 space-y-3 text-left"
        >
          {next && <input type="hidden" name="next" value={next} />}
          {mode === "signup" && (
            <input
              name="name"
              required
              autoComplete="name"
              autoFocus
              placeholder="Your name"
              aria-label="Name"
              defaultValue={state?.fields?.name}
              className={`${input} h-12 rounded-lg px-4 text-[15px]`}
            />
          )}
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus={mode === "login"}
            placeholder="Enter your email address…"
            aria-label="Email"
            defaultValue={email}
            key={email}
            className={`${input} h-12 rounded-lg px-4 text-[15px]`}
          />
          <input
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "signup" ? "Choose a password (8+ characters)" : "Password"}
            aria-label="Password"
            className={`${input} h-12 rounded-lg px-4 text-[15px]`}
          />

          {state?.error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              {state.error}
            </p>
          )}

          {state?.notice && (
            <p role="status" className="rounded-md border border-border bg-muted px-3 py-2 text-[13px] text-muted-foreground">
              {state.notice}
            </p>
          )}

          <button disabled={pending} className={optionPrimary}>
            {pending ? "Please wait…" : `${verb} with email`}
          </button>
          <button
            type="button"
            onClick={() => setStep("choose")}
            className="mx-auto flex items-center gap-1.5 pt-2 text-[13px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} />
            Back to {mode === "login" ? "login" : "sign-up"} options
          </button>
        </form>
      )}

      <p className="mt-10 text-[14px] text-muted-foreground">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <Link href={`/signup${q}`} className="font-medium text-foreground hover:underline underline-offset-4">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={`/login${q}`} className="font-medium text-foreground hover:underline underline-offset-4">
              Log in
            </Link>
          </>
        )}{" "}
        or{" "}
        <a href="/demo.html" target="_blank" className="font-medium text-foreground hover:underline underline-offset-4">
          Learn more
        </a>
      </p>
    </div>
  );
}
