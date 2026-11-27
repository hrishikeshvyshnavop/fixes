import { desc, eq } from "drizzle-orm";
import { Plug } from "lucide-react";
import { getDb, schema } from "@/db";
import { revokeApiToken } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { ago } from "@/lib/ui";
import { PageShell } from "@/components/page-shell";
import { McpConnect } from "@/components/mcp-connect";
import { button } from "@/components/styles";

const TOOLS: [string, string][] = [
  ["list_projects", "Projects you can access, with open / resolved counts"],
  ["list_feedback", "Feedback by project, status and page URL"],
  ["get_feedback", "One item: comment, page URL, CSS selector, browser, thread and screenshot"],
  ["reply_to_feedback", "Post a reply to the reviewer"],
  ["resolve_feedback", "Mark fixed, with a note of what changed"],
  ["reopen_feedback", "Reopen an item"],
];

function Card({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export default async function McpServer() {
  const user = await requireUser();
  const db = await getDb();
  const [tokens, app] = await Promise.all([
    db
      .select()
      .from(schema.apiTokens)
      .where(eq(schema.apiTokens.userId, user.id))
      .orderBy(desc(schema.apiTokens.createdAt)),
    getAppUrl(),
  ]);
  const url = `${app.url}/api/mcp`;

  return (
    <PageShell icon={<Plug size={15} />} section="Fixes AI" title="MCP server">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">MCP server</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Let AI coding tools like Claude Code, Cursor and VS Code read your feedback — with screenshots, page URLs and element
          selectors — and resolve items when the fix ships.
        </p>
      </div>

      {!app.reachable && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px]">
          This address (<code className="font-mono text-xs">{app.url}</code>) only works on this machine. Tools on the same
          computer can connect; for anything else, deploy Fixes and set <code className="font-mono text-xs">APP_URL</code>.
        </p>
      )}

      <Card title="Connect" description={<>Server URL: <code className="font-mono text-xs text-foreground">{url}</code></>}>
        <McpConnect url={url} />
      </Card>

      <Card title="Access tokens" description="Each token acts as you. Revoke any you no longer use.">
        {tokens.length ? (
          <ul className="-my-2 divide-y divide-border">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <code className="font-mono">{t.hint}…</code> · created {ago(t.createdAt)} ·{" "}
                    {t.lastUsedAt ? `last used ${ago(t.lastUsedAt)}` : "never used"}
                  </p>
                </div>
                <form action={revokeApiToken}>
                  <input type="hidden" name="tokenId" value={t.id} />
                  <button className={button.danger}>Revoke</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">No tokens yet.</p>
        )}
      </Card>

      <Card title="Tools" description="What your AI tool can do once connected.">
        <ul className="space-y-2">
          {TOOLS.map(([name, desc]) => (
            <li key={name} className="flex gap-3 text-[13px]">
              <code className="w-36 shrink-0 font-mono text-xs leading-5">{name}</code>
              <span className="text-muted-foreground">{desc}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Try: “List open Fixes feedback for the Demo site and fix DEM-3.”
        </p>
      </Card>
    </PageShell>
  );
}
