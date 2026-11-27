import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { memberProjectIds, requireUser } from "@/lib/auth";
import { hue, initials } from "@/lib/ui";
import { PageShell } from "@/components/page-shell";
import { InviteButton } from "@/components/invite-dialog";
import { button } from "@/components/styles";
import { ownedProjects } from "@/lib/queries";
import { ProjectIcon } from "@/components/project-icon";

/** Everyone who shares at least one project with you, and which projects. */
export default async function WorkspaceMembers() {
  const me = await requireUser();
  const [ids, invitable] = await Promise.all([memberProjectIds(me.id), ownedProjects(me.id)]);
  const db = await getDb();
  const rows = ids.length
    ? await db
        .select({
          userId: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          role: schema.projectMembers.role,
          projectId: schema.projects.id,
          projectName: schema.projects.name,
          icon: schema.projects.icon,
          color: schema.projects.color,
        })
        .from(schema.projectMembers)
        .innerJoin(schema.users, eq(schema.users.id, schema.projectMembers.userId))
        .innerJoin(schema.projects, eq(schema.projects.id, schema.projectMembers.projectId))
        .where(inArray(schema.projectMembers.projectId, ids))
        .orderBy(asc(schema.users.name), asc(schema.projects.name))
    : [];

  const people = new Map<string, { name: string; email: string; projects: typeof rows }>();
  for (const r of rows) {
    const p = people.get(r.userId) ?? { name: r.name, email: r.email, projects: [] };
    p.projects.push(r);
    people.set(r.userId, p);
  }

  return (
    <PageShell icon={<Users size={15} />} section="Workspace" title="Members">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Members</h2>
          <InviteButton projects={invitable} className={button.primary}>
            <UserPlus size={14} /> Invite people
          </InviteButton>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {people.size} {people.size === 1 ? "person" : "people"} across your projects. Invite or remove people from a
          project&apos;s Settings → Members, or use Invite people to add someone to several projects at once.
        </p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {[...people.entries()].map(([id, p]) => (
          <li key={id} className="flex items-start gap-3 px-5 py-3.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
              {initials(p.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">
                {p.name}
                {id === me.id && <span className="ml-1.5 font-normal text-muted-foreground">(you)</span>}
              </div>
              <div className="truncate text-xs text-muted-foreground">{p.email}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.projects.map((pr) => (
                  <Link
                    key={pr.projectId}
                    href={`/projects/${pr.projectId}/settings#members`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs hover:bg-accent"
                  >
                    <ProjectIcon name={pr.projectName} hue={hue(pr.projectId)} icon={pr.icon} color={pr.color} size={12} />
                    {pr.projectName}
                    <span className="text-muted-foreground">· {pr.role === "owner" ? "Owner" : "Member"}</span>
                  </Link>
                ))}
              </div>
            </div>
          </li>
        ))}
        {people.size === 0 && <li className="px-5 py-8 text-center text-[13px] text-muted-foreground">No projects yet.</li>}
      </ul>
    </PageShell>
  );
}
