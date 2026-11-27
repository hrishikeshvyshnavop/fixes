import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";
import { logout } from "@/app/auth-actions";
import { hue } from "@/lib/ui";
import { Avatar } from "./feedback";
import { PROJECT_TYPES, type ProjectType } from "@/lib/project-types";
import { ThemeToggle } from "@/app/theme-toggle";
import { InstallWidgetLink, NewProjectButton, SidebarNav } from "./sidebar-nav";
import { ownedProjects, pendingInvitesFor } from "@/lib/queries";
import { emailVerified } from "@/lib/auth";
import { Notifications } from "./notifications";

async function loadProjects(userId: string) {
  const db = await getDb();
  const { projects, comments, projectMembers } = schema;
  return db
    .select({
      id: projects.id,
      name: projects.name,
      icon: projects.icon,
      color: projects.color,
      type: projects.type,
      open: sql<number>`count(${comments.id}) filter (where ${comments.status} = 'open')`.mapWith(Number),
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .leftJoin(comments, eq(comments.projectId, projects.id))
    .where(eq(projectMembers.userId, userId))
    .groupBy(projects.id)
    .orderBy(asc(projects.createdAt));
}

function Logo() {
  return (
    <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[11px_11px_11px_3px] bg-primary text-[11px] font-bold text-primary-foreground">
      F
    </span>
  );
}

export async function Sidebar({ user }: { user: User }) {
  const [rows, invitable, pending, verified] = await Promise.all([
    loadProjects(user.id),
    ownedProjects(user.id),
    pendingInvitesFor(user.email),
    emailVerified(),
  ]);
  const invites = pending.map((i) => ({
    id: i.id,
    role: i.role,
    createdAt: i.createdAt.toISOString(),
    inviter: i.inviter,
    project: { ...i.project, hue: hue(i.project.id) },
  }));
  const projects = rows.map((p) => ({ ...p, hue: hue(p.id) }));
  const totalOpen = rows.reduce((n, p) => n + p.open, 0);
  const typeCounts = Object.fromEntries(PROJECT_TYPES.map((t) => [t, rows.filter((r) => r.type === t).length])) as Record<ProjectType, number>;

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col md:flex">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 rounded-md text-sm font-semibold">
          <Logo />
          Fixes
        </Link>
        <div className="flex items-center gap-1.5">
          <Notifications invites={invites} verified={verified} email={user.email} />
          <NewProjectButton />
        </div>
      </div>

      <SidebarNav projects={projects} totalOpen={totalOpen} typeCounts={typeCounts} invitable={invitable} />

      <div className="space-y-2 border-t border-sidebar-border px-3 pt-3 pb-3">
        <InstallWidgetLink projectIds={projects.map((p) => p.id)} />
        <div className="flex items-center gap-2 px-1">
          <Link href="/workspace/settings" title="Profile & settings" className="shrink-0 rounded-full">
            <Avatar name={user.name} src={user.avatarUrl} size={24} />
          </Link>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium">{user.name}</div>
            <div className="truncate text-[11px] text-muted-foreground">{user.email}</div>
          </div>
          <form action={logout}>
            <button
              title="Sign out"
              aria-label="Sign out"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
        <div className="px-1">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

/** Compact top bar for narrow screens, where the sidebar is hidden. */
export function MobileBar() {
  return (
    <div className="flex h-12 items-center justify-between gap-3 border-b border-sidebar-border px-4 md:hidden">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
        <Logo />
        Fixes
      </Link>
      <div className="flex items-center gap-3 text-[13px] font-medium text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Inbox
        </Link>
        <Link href="/projects" className="hover:text-foreground">
          Projects
        </Link>
        <ThemeToggle />
      </div>
    </div>
  );
}
