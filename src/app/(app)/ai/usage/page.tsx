import { Gauge } from "lucide-react";
import { NotYet, PageShell } from "@/components/page-shell";

export default function AiUsage() {
  return (
    <PageShell icon={<Gauge size={15} />} section="Fixes AI" title="Usage">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">AI usage</h2>
        <p className="mt-1 text-sm text-muted-foreground">Requests and credits used by Fixes AI across your workspace.</p>
      </div>
      <NotYet title="Fixes AI isn't switched on">
        Nothing has used AI yet, so there&apos;s no usage to report. Once AI features exist (for example, summarizing feedback
        or suggesting fixes), requests and credits will be listed here per project.
      </NotYet>
    </PageShell>
  );
}
