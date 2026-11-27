"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ChevronRight, Globe, Hash, X } from "lucide-react";
import { createProject, type ActionState } from "@/app/actions";
import { DEFAULT_COLOR, DEFAULT_ICON } from "@/lib/project-icons";
import { initials, projectPrefix } from "@/lib/ui";
import { IconPicker } from "./icon-picker";
import { PROJECT_TYPES, TYPE_META, type ProjectType } from "@/lib/project-types";
import { button } from "./styles";

const chip =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[13px] font-medium shadow-xs transition-colors hover:bg-accent dark:bg-input/30 dark:hover:bg-input/50";

/** Property chip with a small popover editor. */
function ChipPopover({
  label,
  title,
  children,
}: {
  label: React.ReactNode;
  title: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" className={`${chip} ${open ? "bg-accent" : ""}`} title={title} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-40 mt-1.5 w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl">
          <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const field =
  "h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export function NewProjectForm({
  user,
  variant,
  onClose,
  initialType,
}: {
  user: { name: string };
  variant: "modal" | "page";
  onClose?: () => void;
  initialType?: ProjectType;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createProject, undefined);
  const [name, setName] = useState("");
  const [look, setLook] = useState({ icon: DEFAULT_ICON, color: DEFAULT_COLOR });
  const [prefix, setPrefix] = useState("");
  const [prefixTouched, setPrefixTouched] = useState(false);
  const [origins, setOrigins] = useState("");
  const [type, setType] = useState<ProjectType>(initialType ?? "website");
  const TypeIcon = TYPE_META[type].Icon;
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const effectivePrefix = prefixTouched ? prefix : name.trim() ? projectPrefix(name) : "";

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const firstOrigin = origins.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <form
      ref={formRef}
      action={action}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          formRef.current?.requestSubmit();
        }
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <input type="hidden" name="prefix" value={effectivePrefix} />
      <input type="hidden" name="allowedOrigins" value={origins} />
      <input type="hidden" name="type" value={type} />

      {/* Header: breadcrumb + close */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 font-medium text-muted-foreground">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-[8px_8px_8px_2px] bg-primary text-[9px] font-bold text-primary-foreground">
              F
            </span>
            Fixes
          </span>
          <ChevronRight size={14} className="text-muted-foreground" />
          <span className="truncate font-medium">New project</span>
        </div>
        {variant === "modal" ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 sm:px-10">
        <div className="pt-4">
          <IconPicker value={look} onChange={setLook} name={name} />
        </div>

        <input
          ref={nameRef}
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          placeholder="Project name"
          aria-label="Project name"
          autoComplete="off"
          className="mt-4 w-full bg-transparent text-[28px] leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
        />
        <input
          name="summary"
          maxLength={255}
          placeholder="Add a short summary…"
          aria-label="Summary"
          autoComplete="off"
          className="mt-2 w-full bg-transparent text-[17px] text-foreground/90 outline-none placeholder:text-muted-foreground/60"
        />

        {/* Property chips */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <ChipPopover
            title="Project type"
            label={
              <>
                <TypeIcon size={14} className="text-muted-foreground" />
                {TYPE_META[type].label}
              </>
            }
          >
            {(close) => (
              <div role="listbox" aria-label="Project type" className="-mx-1 space-y-px">
                {PROJECT_TYPES.map((t) => {
                  const { Icon, label, hint } = TYPE_META[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      role="option"
                      aria-selected={type === t}
                      onClick={() => {
                        setType(t);
                        close();
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent ${type === t ? "bg-accent" : ""}`}
                    >
                      <Icon size={15} className="text-muted-foreground" />
                      <span className="flex-1">
                        <span className="block text-[13px] font-medium">{label}</span>
                        <span className="block text-xs text-muted-foreground">{hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </ChipPopover>
          <ChipPopover
            title="Identifier, used in feedback ids"
            label={
              <>
                <Hash size={14} className="text-muted-foreground" />
                {effectivePrefix ? <span className="font-mono">{effectivePrefix}</span> : <span className="text-muted-foreground">Identifier</span>}
              </>
            }
          >
            {(close) => (
              <>
                <input
                  autoFocus
                  value={effectivePrefix}
                  onChange={(e) => {
                    setPrefixTouched(true);
                    setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5));
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), close())}
                  placeholder="WEB"
                  className={`${field} font-mono uppercase`}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Feedback will be numbered <span className="font-mono text-foreground">{effectivePrefix || "WEB"}-1</span>,{" "}
                  <span className="font-mono text-foreground">{effectivePrefix || "WEB"}-2</span>… 1–5 letters or digits.
                </p>
              </>
            )}
          </ChipPopover>

          <ChipPopover
            title="Allowed origins"
            label={
              <>
                <Globe size={14} className="text-muted-foreground" />
                {firstOrigin.length ? (
                  <span className="max-w-48 truncate">
                    {firstOrigin[0].replace(/^https?:\/\//, "")}
                    {firstOrigin.length > 1 && <span className="text-muted-foreground"> +{firstOrigin.length - 1}</span>}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Any website</span>
                )}
              </>
            }
          >
            {(close) => (
              <>
                <input
                  autoFocus
                  value={origins}
                  onChange={(e) => setOrigins(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), close())}
                  placeholder="https://example.com"
                  className={field}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Comma-separated sites allowed to send feedback with this project&apos;s key. Leave empty to allow any.
                </p>
              </>
            )}
          </ChipPopover>

          <span className={`${chip} cursor-default hover:bg-background dark:hover:bg-input/30`} title="You'll be the project owner">
            <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-1 ring-border">
              {initials(user.name)}
            </span>
            {user.name}
            <span className="text-muted-foreground">· Owner</span>
          </span>
        </div>

        <div className="my-6 border-t border-border" />

        <textarea
          name="description"
          maxLength={10000}
          rows={6}
          placeholder="Write a description, a project brief, or collect ideas…"
          aria-label="Description"
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = `${t.scrollHeight}px`;
          }}
          className="block min-h-[160px] w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
        {state?.error && (
          <p role="alert" className="mr-auto text-[13px] text-destructive">
            {state.error}
          </p>
        )}
        {variant === "modal" ? (
          <button type="button" onClick={onClose} className={button.outline}>
            Cancel
          </button>
        ) : (
          <Link href="/projects" className={button.outline}>
            Cancel
          </Link>
        )}
        <button disabled={pending || !name.trim()} className={button.primary} title="Create project (Ctrl/⌘ + Enter)">
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}
