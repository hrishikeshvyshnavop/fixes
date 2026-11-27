"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Copy, UserPlus, X } from "lucide-react";
import { createInvites, type InviteBatchState, type InviteResult } from "@/app/actions";
import { hue } from "@/lib/ui";
import { ProjectIcon } from "./project-icon";
import { button } from "./styles";

export type InvitableProject = { id: string; name: string; icon: string | null; color: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- trigger ----------

/**
 * Button that opens the "Invite people" dialog. `projects` = projects the viewer owns;
 * `defaultProjectIds` preselects (e.g. the project you're looking at).
 */
export function InviteButton({
  projects,
  defaultProjectIds = [],
  className,
  children,
}: {
  projects: InvitableProject[];
  defaultProjectIds?: string[];
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? button.ghost} aria-haspopup="dialog">
        {children ?? (
          <>
            <UserPlus size={14} /> Invite
          </>
        )}
      </button>
      {open && <InviteDialog projects={projects} defaultProjectIds={defaultProjectIds} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---------- dialog ----------

function InviteDialog({
  projects,
  defaultProjectIds,
  onClose,
}: {
  projects: InvitableProject[];
  defaultProjectIds: string[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<InviteBatchState, FormData>(createInvites, undefined);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState<"member" | "owner">("member");
  const [selected, setSelected] = useState<string[]>(() => {
    const valid = defaultProjectIds.filter((id) => projects.some((p) => p.id === id));
    return valid.length ? valid : projects.length === 1 ? [projects[0].id] : [];
  });
  // Results show for the latest action result until "Invite more" dismisses that result.
  const [dismissed, setDismissed] = useState<InviteBatchState>(undefined);
  const showResults = !!state?.results && state !== dismissed;
  const panel = useRef<HTMLDivElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const titleId = useId();

  // Esc closes, page scroll locked, focus returns to the trigger.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => emailInput.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [onClose]);

  // Turn typed/pasted text into chips (comma, space, semicolon or newline separated).
  const commit = (text: string) => {
    const parts = text
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!parts.length) return;
    setEmails((cur) => [...new Set([...cur, ...parts])]);
    setDraft("");
  };

  const allEmails = useMemo(() => {
    const d = draft.trim().toLowerCase();
    return d ? [...new Set([...emails, d])] : emails;
  }, [emails, draft]);
  const invalid = allEmails.filter((e) => !EMAIL_RE.test(e));
  const total = allEmails.length * selected.length;
  const canSubmit = allEmails.length > 0 && invalid.length === 0 && selected.length > 0 && !pending;

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const reset = () => {
    setEmails([]);
    setDraft("");
    setDismissed(state);
    setTimeout(() => emailInput.current?.focus(), 0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 backdrop-blur-[2px] sm:pt-[10vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <h2 id={titleId} className="flex items-center gap-2 text-[15px] font-semibold">
            <UserPlus size={16} className="text-muted-foreground" />
            {showResults ? "Invites ready" : "Invite people"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium">You don&apos;t own any projects yet</p>
            <p className="mx-auto mt-1.5 max-w-xs text-[13px] text-muted-foreground">
              Only project owners can invite people. Create a project, or ask an owner to invite your teammate.
            </p>
            <Link href="/projects/new" onClick={onClose} className={`${button.primary} mt-5`}>
              Create a project
            </Link>
          </div>
        ) : showResults && state?.results ? (
          <Results results={state.results} onMore={reset} onDone={onClose} />
        ) : (
          <form action={action} className="flex min-h-0 flex-1 flex-col">
            {allEmails.map((e) => (
              <input key={e} type="hidden" name="email" value={e} />
            ))}
            {selected.map((id) => (
              <input key={id} type="hidden" name="projectId" value={id} />
            ))}
            <input type="hidden" name="role" value={role} />

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {/* Emails */}
              <div>
                <label htmlFor={`${titleId}-emails`} className="text-[13px] font-medium">
                  Email addresses
                </label>
                <div
                  className="mt-1.5 flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30"
                  onClick={() => emailInput.current?.focus()}
                >
                  {emails.map((e) => {
                    const ok = EMAIL_RE.test(e);
                    return (
                      <span
                        key={e}
                        className={`inline-flex h-7 max-w-full items-center gap-1 rounded-md pr-1 pl-2 text-[13px] ${
                          ok ? "bg-secondary text-secondary-foreground" : "bg-destructive/15 text-destructive"
                        }`}
                        title={ok ? e : "Not a valid email address"}
                      >
                        <span className="truncate">{e}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${e}`}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setEmails((cur) => cur.filter((x) => x !== e));
                          }}
                          className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-foreground/10"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                  <input
                    id={`${titleId}-emails`}
                    ref={emailInput}
                    value={draft}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/[\s,;]$/.test(v)) commit(v);
                      else setDraft(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (draft.trim()) commit(draft);
                        else if (canSubmit) e.currentTarget.form?.requestSubmit();
                      } else if (e.key === "Backspace" && !draft && emails.length) {
                        setEmails((cur) => cur.slice(0, -1));
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (/[\s,;]/.test(text.trim())) {
                        e.preventDefault();
                        commit(draft + text);
                      }
                    }}
                    onBlur={() => draft.trim() && commit(draft)}
                    placeholder={emails.length ? "" : "name@company.com, another@company.com"}
                    autoComplete="off"
                    spellCheck={false}
                    className="h-7 min-w-[160px] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {invalid.length ? (
                    <span className="text-destructive">Fix or remove: {invalid.join(", ")}</span>
                  ) : (
                    <>Press Enter or comma to add. You can paste a whole list.</>
                  )}
                </p>
              </div>

              {/* Role */}
              <div>
                <span className="text-[13px] font-medium">Role</span>
                <div role="radiogroup" aria-label="Role" className="mt-1.5 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["member", "Member", "Reply to, resolve and delete feedback"],
                      ["owner", "Owner", "Also manage settings, members and invites"],
                    ] as const
                  ).map(([value, label, hint]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={role === value}
                      onClick={() => setRole(value)}
                      className={`rounded-md border px-3 py-2 text-left transition-colors ${
                        role === value ? "border-ring bg-accent" : "border-border hover:bg-accent/50"
                      }`}
                    >
                      <span className="flex items-center justify-between text-[13px] font-medium">
                        {label}
                        {role === value && <Check size={14} />}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Projects */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium">Projects</span>
                  {projects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelected(selected.length === projects.length ? [] : projects.map((p) => p.id))}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {selected.length === projects.length ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>
                <ul className="mt-1.5 max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border">
                  {projects.map((p) => {
                    const on = selected.includes(p.id);
                    return (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-accent/50">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(p.id)}
                            className="h-4 w-4 accent-[var(--primary)]"
                          />
                          <ProjectIcon name={p.name} hue={hue(p.id)} icon={p.icon} color={p.color} size={15} />
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1.5 text-xs text-muted-foreground">Only projects you own are listed.</p>
              </div>

              {state?.error && (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                  {state.error}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-3">
              <span className="text-xs text-muted-foreground">
                {total > 0
                  ? `${total} invite link${total === 1 ? "" : "s"} · ${allEmails.length} ${allEmails.length === 1 ? "person" : "people"} × ${selected.length} project${selected.length === 1 ? "" : "s"}`
                  : "Links expire in 7 days"}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className={button.outline}>
                  Cancel
                </button>
                <button disabled={!canSubmit} className={button.primary}>
                  {pending ? "Creating…" : "Create invites"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------- results ----------

function Results({ results, onMore, onDone }: { results: InviteResult[]; onMore: () => void; onDone: () => void }) {
  const ok = results.filter((r) => r.link);
  const failed = results.filter((r) => r.error);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard blocked; links stay selectable */
    }
  };
  const allText = ok.map((r) => `${r.email} (${r.projectName}): ${r.link}`).join("\n");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <p className="text-[13px] text-muted-foreground">
          {ok.length ? (
            <>
              Send each person their link. Links are single-use, expire in 7 days, and only work for someone signed in with that
              email. They&apos;re shown only once.
            </>
          ) : (
            "No invites were created."
          )}
        </p>

        {ok.length > 0 && (
          <ul className="mt-3 divide-y divide-border rounded-md border border-border">
            {ok.map((r) => {
              const key = `${r.email}|${r.projectId}`;
              return (
                <li key={key} className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="min-w-0 truncate font-medium">{r.email}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.projectName}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded border border-border bg-muted px-2 py-1 font-mono text-xs select-all">
                      {r.link}
                    </code>
                    <button
                      type="button"
                      onClick={() => copy(key, r.link!)}
                      className={`${button.outline} h-7 shrink-0 px-2`}
                      aria-label={`Copy link for ${r.email}`}
                    >
                      {copied === key ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {failed.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-medium text-muted-foreground">Not invited ({failed.length})</h3>
            <ul className="mt-1.5 space-y-1">
              {failed.map((r) => (
                <li key={`${r.email}|${r.projectId}`} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0 truncate">
                    {r.email} <span className="text-muted-foreground">· {r.projectName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{r.error}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-3">
        {ok.length > 1 ? (
          <button type="button" onClick={() => copy("all", allText)} className={button.outline}>
            {copied === "all" ? <Check size={14} /> : <Copy size={14} />} Copy all
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onMore} className={button.outline}>
            Invite more
          </button>
          <button type="button" onClick={onDone} className={button.primary}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
