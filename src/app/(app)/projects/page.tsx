import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hue, shortDate } from "@/lib/ui";
import { requireUser } from "@/lib/auth";
import { TYPE_META, isProjectType } from "@/lib/project-types";
import { Swatch } from "@/components/sidebar-nav";
import { BoxIcon, PlusIcon } from "@/components/icons";
import { EmptyState, PanelHeader, button } from "@/components/feedback";

export default async function Projects({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type: typeParam } = await searchParams;
  const type = isProjectType(typeParam) ? typeParam : undefined;
  const user = await requireUser();
  const db = await getDb();
  const { projects, comments, projectMembers } = schema;
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
      allowedOrigins: projects.allowedOrigins,
      prefix: projects.prefix,
      icon: projects.icon,
      color: projects.color,
      summary: projects.summary,
      type: projects.type,
      role: projectMembers.role,
      open: sql<number>`count(${comments.id}) filter (where ${comments.status} = 'open')`.mapWith(Number),
      total: sql<number>`count(${comments.id})`.mapWith(Number),
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .leftJoin(comments, eq(comments.projectId, projects.id))
    .where(type ? and(eq(projectMembers.userId, user.id), eq(projects.type, type)) : eq(projectMembers.userId, user.id))
    .groupBy(projects.id, projectMembers.role)
    .orderBy(desc(projects.createdAt));

  return (
    <>
      <PanelHeader
        right={
          <Link href={type ? `/projects/new?type=${type}` : "/projects/new"} className={button.primary}>
            <PlusIcon size={14} /> New project
          </Link>
        }
      >
        {type ? (
          <>
            <Link href="/projects" className="text-[13px] text-muted-foreground hover:text-foreground">
              Projects
            </Link>
            <span className="text-muted-foreground">/</span>
            {(() => {
              const { Icon, label } = TYPE_META[type];
              return (
                <h1 className="flex items-center gap-1.5 text-[13px] font-medium">
                  <Icon size={15} className="text-muted-foreground" />
                  {label}
                </h1>
              );
            })()}
          </>
        ) : (
          <>
            <BoxIcon size={15} className="text-muted-foreground" />
            <h1 className="text-[13px] font-medium">Projects</h1>
          </>
        )}
        <span className="text-[13px] text-muted-foreground tabular-nums">{rows.length}</span>
      </PanelHeader>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-10">
          <EmptyState title={type ? `No ${TYPE_META[type].label.toLowerCase()} projects` : "No projects"}>
            {type ? TYPE_META[type].hint + ". " : ""}
            <Link href={type ? `/projects/new?type=${type}` : "/projects/new"} className="font-medium text-foreground underline underline-offset-4">
              Create one
            </Link>
          </EmptyState>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid h-9 grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-4 text-xs text-muted-foreground sm:grid-cols-[1fr_80px_80px_90px]">
            <span>Name</span>
            <span className="hidden text-right sm:block">Open</span>
            <span className="hidden text-right sm:block">Total</span>
            <span className="text-right">Created</span>
          </div>
          <ul>
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="grid h-12 grid-cols-[1fr_auto] items-center gap-4 border-b border-border/60 px-4 text-[13px] hover:bg-accent/50 sm:grid-cols-[1fr_80px_80px_90px]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Swatch name={p.name} hue={hue(p.id)} icon={p.icon} color={p.color} size={18} />
                    <span className="truncate font-medium">{p.name}</span>
                    {p.summary && <span className="hidden min-w-0 truncate text-muted-foreground md:inline">{p.summary}</span>}
                    <span className="font-mono text-xs text-muted-foreground">{p.prefix}</span>
                    {!type && isProjectType(p.type) && (
                      <span className="hidden items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground sm:inline-flex">
                        {(() => {
                          const { Icon, label } = TYPE_META[p.type];
                          return (
                            <>
                              <Icon size={11} /> {label}
                            </>
                          );
                        })()}
                      </span>
                    )}
                    {p.role === "owner" && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">Owner</span>}
                    {p.allowedOrigins && (
                      <span className="hidden truncate rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground lg:inline">
                        {p.allowedOrigins.split(",")[0].trim()}
                        {p.allowedOrigins.includes(",") && " +"}
                      </span>
                    )}
                  </span>
                  <span className="hidden text-right tabular-nums sm:block">{p.open}</span>
                  <span className="hidden text-right text-muted-foreground tabular-nums sm:block">{p.total}</span>
                  <span className="text-right text-muted-foreground">{shortDate(p.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
