import { PanelHeader } from "./feedback";

/** Simple titled page inside the app panel (header + centered column). */
export function PageShell({
  icon,
  section,
  title,
  children,
}: {
  icon: React.ReactNode;
  section?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PanelHeader>
        <span className="text-muted-foreground">{icon}</span>
        {section && (
          <>
            <span className="text-[13px] text-muted-foreground">{section}</span>
            <span className="text-muted-foreground">/</span>
          </>
        )}
        <h1 className="text-[13px] font-medium">{title}</h1>
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-5 px-6 py-10">{children}</div>
      </div>
    </>
  );
}

export function NotYet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <span className="inline-flex rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        Not available yet
      </span>
      <h2 className="mt-3 text-sm font-semibold">{title}</h2>
      <div className="mx-auto mt-1.5 max-w-md text-[13px] text-muted-foreground">{children}</div>
    </section>
  );
}
