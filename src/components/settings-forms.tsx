"use client";

import { useActionState, useEffect, useState } from "react";
import { createInvite, updateProject, type ActionState } from "@/app/actions";
import { DEFAULT_COLOR, DEFAULT_ICON } from "@/lib/project-icons";
import { IconPicker } from "./icon-picker";
import { PROJECT_TYPES, TYPE_META } from "@/lib/project-types";
import { button, input } from "./styles";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked (e.g. insecure origin); the text is still selectable */
        }
      }}
      className={`${button.outline} h-7 shrink-0`}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function Status({ state }: { state: ActionState }) {
  // A success message hides itself after a moment; errors stay until the next submit.
  const [hidden, setHidden] = useState<ActionState>(undefined);
  useEffect(() => {
    if (!state?.ok) return;
    const t = setTimeout(() => setHidden(state), 2500);
    return () => clearTimeout(t);
  }, [state]);
  if (!state || state === hidden) return null;
  return (
    <span role="status" className={`text-[13px] ${state.error ? "text-destructive" : "text-emerald-500"}`}>
      {state.error ?? `✓ ${state.ok}`}
    </span>
  );
}

export function ProjectSettingsForm({
  project,
  canEdit,
}: {
  project: {
    id: string;
    name: string;
    prefix: string;
    allowedOrigins: string;
    icon: string | null;
    color: string | null;
    summary: string;
    description: string;
    type: string;
  };
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateProject, undefined);
  const [prefix, setPrefix] = useState(project.prefix);
  const changed = prefix.toUpperCase() !== project.prefix;
  const [look, setLook] = useState({ icon: project.icon ?? DEFAULT_ICON, color: project.color ?? DEFAULT_COLOR });
  const [name, setName] = useState(project.name);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="projectId" value={project.id} />
      <fieldset disabled={!canEdit} className="space-y-4 disabled:opacity-70">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr_140px]">
          <div>
            <span className="block text-[13px] font-medium">Icon</span>
            <div className="mt-1.5">
              <IconPicker value={look} onChange={setLook} name={name} />
            </div>
          </div>
          <label className="block">
            <span className="text-[13px] font-medium">Name</span>
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              className={`${input} mt-1.5`}
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium">Identifier</span>
            <input
              name="prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
              required
              className={`${input} mt-1.5 font-mono uppercase`}
            />
          </label>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Renaming keeps feedback ids as they are. The identifier is what appears in ids like{" "}
          <span className="font-mono text-foreground">{(prefix || project.prefix).toUpperCase()}-12</span>.
          {changed && <span className="text-amber-500"> Changing it updates every existing id in this project.</span>}
        </p>
        <label className="block">
          <span className="text-[13px] font-medium">Type</span>
          <select name="type" defaultValue={project.type} className={`${input} mt-1.5`}>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_META[t].label}: {TYPE_META[t].hint}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Summary</span>
          <input name="summary" defaultValue={project.summary} maxLength={255} placeholder="A short summary of the project" className={`${input} mt-1.5`} />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Description</span>
          <textarea
            name="description"
            defaultValue={project.description}
            maxLength={10000}
            rows={4}
            placeholder="A project brief, goals, or anything reviewers should know"
            className={`${input} mt-1.5 h-auto py-2 leading-relaxed`}
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium">Allowed origins</span>
          <input
            name="allowedOrigins"
            defaultValue={project.allowedOrigins}
            placeholder="https://example.com, http://localhost:5173"
            className={`${input} mt-1.5`}
          />
          <span className="mt-1.5 block text-xs text-muted-foreground">
            Comma-separated. <span className="font-mono">example.com</span> allows that site on http and https;{" "}
            <span className="font-mono">*.example.com</span> adds subdomains. Leave empty to accept any site.
          </span>
        </label>
      </fieldset>
      {canEdit ? (
        <div className="flex items-center justify-end gap-3">
          <Status state={state} />
          <button disabled={pending} className={button.primary}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Only project owners can change these settings.</p>
      )}
    </form>
  );
}

export function InviteForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createInvite, undefined);
  return (
    <div>
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="projectId" value={projectId} />
        <input name="email" type="email" required placeholder="teammate@company.com" className={`${input} flex-1`} key={state?.link} />
        <select
          name="role"
          defaultValue="member"
          aria-label="Role"
          className={`${input} sm:w-32`}
        >
          <option value="member">Member</option>
          <option value="owner">Owner</option>
        </select>
        <button disabled={pending} className={`${button.primary} h-9`}>
          {pending ? "Creating…" : "Create invite"}
        </button>
      </form>
      {state?.error && <p className="mt-2 text-[13px] text-destructive">{state.error}</p>}
      {state?.link && (
        <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
          <p className="text-[13px] font-medium">
            {state.emailed
              ? `${state.ok}. They'll also see it in their notifications. Backup link:`
              : `${state.ok}, but it wasn't emailed (${state.emailError ?? "email isn't set up"}). Send them this link:`}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded border border-border bg-background px-2 py-1.5 font-mono text-xs select-all">
              {state.link}
            </code>
            <CopyButton text={state.link} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Shown once, single-use, expires in 7 days. Only someone signed in as that email can accept it.
          </p>
        </div>
      )}
    </div>
  );
}
