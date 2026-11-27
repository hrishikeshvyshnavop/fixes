import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { listComments } from "@/lib/queries";
import { hue } from "@/lib/ui";
import { requireUser } from "@/lib/auth";
import { Swatch } from "@/components/sidebar-nav";
import { InboxIcon, PlusIcon } from "@/components/icons";
import { EmptyState, FeedbackGroups, PanelHeader, Toolbar, ViewTabs, button, parseFilter, type Filter } from "@/components/feedback";

export default async function Inbox({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const filter = parseFilter((await searchParams).status);
  const user = await requireUser();
  const db = await getDb();
  const projects = await db
    .select({ id: schema.projects.id, name: schema.projects.name, prefix: schema.projects.prefix, icon: schema.projects.icon, color: schema.projects.color })
    .from(schema.projects)
    .innerJoin(schema.projectMembers, eq(schema.projectMembers.projectId, schema.projects.id))
    .where(eq(schema.projectMembers.userId, user.id))
    .orderBy(asc(schema.projects.createdAt));
  const all = await listComments({ projectIds: projects.map((p) => p.id) });

  const counts = {
    all: all.length,
    open: all.filter((c) => c.status === "open").length,
    resolved: all.filter((c) => c.status === "resolved").length,
  };
  const shown = filter === "all" ? all : all.filter((c) => c.status === filter);
  const prefixes = Object.fromEntries(projects.map((p) => [p.id, p.prefix]));

  const groups = projects.map((p) => ({
    key: p.id,
    label: (
      <Link href={`/projects/${p.id}`} className="relative z-10 hover:underline">
        {p.name}
      </Link>
    ),
    icon: <Swatch name={p.name} hue={hue(p.id)} icon={p.icon} color={p.color} size={14} />,
    items: shown.filter((c) => c.projectId === p.id),
  }));

  return (
    <>
      <PanelHeader
        right={
          <Link href="/projects/new" className={button.ghost}>
            <PlusIcon size={14} /> New project
          </Link>
        }
      >
        <ViewTabs current={filter} counts={counts} href={(f: Filter) => (f === "open" ? "/" : `/?status=${f}`)} />
      </PanelHeader>
      <Toolbar>
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <InboxIcon size={15} className="text-muted-foreground" />
          Inbox
        </span>
        <span className="text-[13px] text-muted-foreground">Feedback from every project</span>
      </Toolbar>
      <FeedbackGroups
        groups={groups}
        prefixes={prefixes}
        empty={
          filter === "open" && counts.all > 0 ? (
            <EmptyState title="Inbox zero">All feedback has been resolved.</EmptyState>
          ) : (
            <EmptyState title="No feedback yet">
              Open the{" "}
              <a href="/demo.html" target="_blank" className="font-medium text-foreground underline underline-offset-4">
                demo site
              </a>
              , click <span className="font-medium text-foreground">Feedback</span>, and pin a comment anywhere on the page.
            </EmptyState>
          )
        }
      />
    </>
  );
}
