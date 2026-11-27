import { Plug } from "lucide-react";
import { NotYet, PageShell } from "@/components/page-shell";

export default function McpServer() {
  return (
    <PageShell icon={<Plug size={15} />} section="Fixes AI" title="MCP server">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">MCP server</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect AI coding tools to your feedback through the Model Context Protocol.
        </p>
      </div>
      <NotYet title="The MCP server isn't built yet">
        The plan is to let tools like Claude Code read open feedback (with screenshots, page URLs and element selectors) and
        mark items resolved when a fix ships. There&apos;s no endpoint to connect to yet, so no connection details are shown.
      </NotYet>
    </PageShell>
  );
}
