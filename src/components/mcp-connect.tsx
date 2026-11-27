"use client";

import { useActionState, useState } from "react";
import { createApiToken, type TokenState } from "@/app/actions";
import { CopyButton } from "./settings-forms";
import { button, input } from "./styles";

const PLACEHOLDER = "<YOUR_TOKEN>";

function clients(url: string, token: string) {
  const header = `Bearer ${token}`;
  const jsonConfig = (key: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ [key]: { fixes: { ...extra, url, headers: { Authorization: header } } } }, null, 2);
  return [
    {
      id: "claude",
      label: "Claude Code",
      hint: <>Run in your project folder. Add <code>--scope user</code> to use it in every project.</>,
      code: `claude mcp add --transport http fixes ${url} --header "Authorization: ${header}"`,
    },
    {
      id: "cursor",
      label: "Cursor",
      hint: <>Add to <code>.cursor/mcp.json</code> (project) or <code>~/.cursor/mcp.json</code> (global).</>,
      code: jsonConfig("mcpServers"),
    },
    {
      id: "vscode",
      label: "VS Code",
      hint: <>Add to <code>.vscode/mcp.json</code>, then start the server from the MCP view.</>,
      code: jsonConfig("servers", { type: "http" }),
    },
    {
      id: "other",
      label: "Other",
      hint: <>Any MCP client that supports Streamable HTTP. Send the token as a Bearer header.</>,
      code: `URL:     ${url}\nHeader:  Authorization: ${header}`,
    },
  ];
}

export function McpConnect({ url }: { url: string }) {
  const [state, action, pending] = useActionState<TokenState, FormData>(createApiToken, undefined);
  const [active, setActive] = useState("claude");
  const token = state?.token ?? PLACEHOLDER;
  const list = clients(url, token);
  const cur = list.find((c) => c.id === active)!;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[13px] font-medium">1. Create an access token</h3>
        <form action={action} className="mt-2 flex flex-col gap-2 sm:flex-row" key={state?.token}>
          <input name="name" placeholder="Token name, e.g. Laptop – Claude Code" maxLength={60} className={`${input} flex-1`} />
          <button disabled={pending} className={`${button.primary} h-9`}>
            {pending ? "Creating…" : "Create token"}
          </button>
        </form>
        {state?.error && <p className="mt-2 text-[13px] text-destructive">{state.error}</p>}
        {state?.token && (
          <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-[13px] font-medium">“{state.name}” created. Copy it now — it won&apos;t be shown again.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded border border-border bg-background px-2 py-1.5 font-mono text-xs select-all">
                {state.token}
              </code>
              <CopyButton text={state.token} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              It has the same access as your account: every project you&apos;re a member of. The snippets below already include it.
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-[13px] font-medium">2. Add Fixes to your AI tool</h3>
        <div role="tablist" aria-label="Client" className="-mx-1 mt-2 flex flex-wrap gap-1 pb-3">
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === active}
              onClick={() => setActive(c.id)}
              className={`h-7 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
                c.id === active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground [&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground">{cur.hint}</p>
        <div className="mt-3 flex items-start gap-2">
          <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-muted px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
            {cur.code}
          </pre>
          <CopyButton text={cur.code} />
        </div>
        {!state?.token && (
          <p className="mt-2 text-xs text-muted-foreground">
            Replace <code className="font-mono">{PLACEHOLDER}</code> with your token, or create one above to fill it in.
          </p>
        )}
      </div>
    </div>
  );
}
