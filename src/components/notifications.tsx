"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Bell, Mail } from "lucide-react";
import { acceptInviteInApp, declineInvite } from "@/app/auth-actions";
import { ProjectIcon } from "./project-icon";
import { button } from "./styles";

export type InviteNotification = {
  id: string;
  role: "owner" | "member";
  createdAt: string;
  project: { id: string; name: string; icon: string | null; color: string | null; hue: number };
  inviter: string | null;
};

function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((new Date().getTime() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Submit({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className}>
      {pending ? "…" : children}
    </button>
  );
}

/** Sidebar bell listing pending project invitations for the signed-in user's email. */
export function Notifications({
  invites,
  verified,
  email,
}: {
  invites: InviteNotification[];
  verified: boolean;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const count = invites.length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count ? `Notifications: ${count} pending invitation${count === 1 ? "" : "s"}` : "Notifications"}
        title="Notifications"
        className="relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-sidebar-border bg-background text-sidebar-foreground shadow-xs hover:bg-sidebar-accent"
      >
        <Bell size={14} />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute top-9 left-0 z-50 w-[340px] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="text-[13px] font-semibold">Notifications</h2>
            {count > 0 && <span className="text-xs text-muted-foreground">{count} pending</span>}
          </div>

          {count === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell size={18} className="mx-auto text-muted-foreground" />
              <p className="mt-2 text-[13px] font-medium">You&apos;re all caught up</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Project invitations will show up here.</p>
            </div>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
              {invites.map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3">
                  <ProjectIcon
                    name={n.project.name}
                    hue={n.project.hue}
                    icon={n.project.icon}
                    color={n.project.color}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug">
                      <span className="font-medium">{n.inviter ?? "Someone"}</span> invited you to join{" "}
                      <span className="font-medium">{n.project.name}</span> as {n.role === "owner" ? "an owner" : "a member"}.
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                    {verified ? (
                      <div className="mt-2 flex gap-2">
                        <form action={acceptInviteInApp}>
                          <input type="hidden" name="inviteId" value={n.id} />
                          <Submit className={`${button.primary} h-7`}>Accept</Submit>
                        </form>
                        <form action={declineInvite}>
                          <input type="hidden" name="inviteId" value={n.id} />
                          <Submit className={`${button.ghost} h-7`}>Decline</Submit>
                        </form>
                      </div>
                    ) : (
                      <p className="mt-2 flex items-start gap-1.5 rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                        <Mail size={13} className="mt-px shrink-0" />
                        <span>
                          To accept, open the invite link sent to <span className="text-foreground">{email}</span>. It confirms the
                          address is yours.
                        </span>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
