import Link from "next/link";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { allowBlockedOrigin, deleteProject, removeMember, revokeInvite, setMemberRole } from "@/app/actions";
import { getAccess } from "@/lib/auth";
import { TYPE_META, isProjectType, supportsWidget } from "@/lib/project-types";
import { ago, expiresIn, hue } from "@/lib/ui";
import { Swatch } from "@/components/sidebar-nav";
import { ChevronRightIcon, ExternalLinkIcon, TrashIcon } from "@/components/icons";
import { Avatar, PanelHeader, button } from "@/components/feedback";
import { InviteForm, ProjectSettingsForm } from "@/components/settings-forms";
import { Bookmarklet, CheckAgainButton, InstallTabs } from "@/components/install-tabs";
import { getAppUrl } from "@/lib/app-url";

function Card({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;

export default async function ProjectSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, role, user } = await getAccess(id);
  const isOwner = role === "owner";

  const db = await getDb();
  const members = await db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
      role: schema.projectMembers.role,
      joined: schema.projectMembers.createdAt,
    })
    .from(schema.projectMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.projectMembers.userId))
    .where(eq(schema.projectMembers.projectId, id))
    .orderBy(asc(schema.projectMembers.createdAt));
  const ownerCount = members.filter((m) => m.role === "owner").length;

  const pending = isOwner
    ? await db
        .select()
        .from(schema.invites)
        .where(and(eq(schema.invites.projectId, id), isNull(schema.invites.acceptedAt), gt(schema.invites.expiresAt, new Date())))
        .orderBy(asc(schema.invites.createdAt))
    : [];

  const app = await getAppUrl();
  const widgetSrc = `${app.url}/widget.js`;
  // Install health: blocked is only "current" if it happened after the last successful check-in.
  const blockedIsLatest =
    !!project.widgetBlockedAt && (!project.widgetSeenAt || project.widgetBlockedAt > project.widgetSeenAt);

  return (
    <>
      <PanelHeader>
        <Swatch name={project.name} hue={hue(project.id)} icon={project.icon} color={project.color} size={16} />
        <Link href={`/projects/${id}`} className="truncate text-[13px] text-muted-foreground hover:text-foreground">
          {project.name}
        </Link>
        <ChevronRightIcon size={13} className="shrink-0 text-muted-foreground" />
        <h1 className="text-[13px] font-medium">Settings</h1>
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-5 px-6 py-10">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{project.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Feedback ids look like <span className="font-mono text-foreground">{project.prefix}-1</span> · You&apos;re{" "}
              {isOwner ? "an owner" : "a member"}
            </p>
          </div>

          {supportsWidget(project.type) ? (
          <Card
            id="install"
            title="Install the widget"
            description="Add one script to your site. Anyone visiting can then click Feedback and pin comments."
          >
            {/* Status */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2.5 text-[13px]">
              {blockedIsLatest ? (
                <span className="flex items-start gap-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <span>
                    Loaded on <span className="font-mono">{project.widgetBlockedOrigin}</span> {ago(project.widgetBlockedAt!)}, but
                    that site isn&apos;t in <a href="#general" className="underline underline-offset-4">Allowed origins</a>, so it was
                    refused and the widget stays hidden there.
                    {isOwner && (
                      <form action={allowBlockedOrigin} className="mt-2">
                        {hidden("projectId", id)}
                        <button className={`${button.primary} h-7`}>
                          Allow <span className="font-mono">{project.widgetBlockedOrigin}</span>
                        </button>
                      </form>
                    )}
                  </span>
                </span>
              ) : project.widgetSeenAt ? (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <span className="min-w-0 truncate">
                    Installed. Last seen {ago(project.widgetSeenAt)} on{" "}
                    <a href={project.widgetSeenUrl ?? "#"} target="_blank" className="font-mono underline-offset-4 hover:underline">
                      {project.widgetSeenUrl}
                    </a>
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full border border-muted-foreground" />
                  Waiting for the widget. Add the snippet, then open a page on your site.
                </span>
              )}
              <CheckAgainButton />
            </div>

            {!app.reachable && (
              <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[13px]">
                <p className="font-medium">This snippet only works on this computer.</p>
                <p className="mt-1 text-muted-foreground">
                  It points at <span className="font-mono text-foreground">{app.url}</span>. Live websites can&apos;t load scripts from
                  your machine. Deploy Fixes to a public HTTPS address and set{" "}
                  <code className="font-mono text-xs text-foreground">APP_URL</code> to it; the snippet updates automatically. Until
                  then, test with the demo site or the bookmarklet below in this browser.
                </p>
              </div>
            )}

            <InstallTabs src={widgetSrc} publicKey={project.publicKey} />

            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-[13px] font-medium">Try it without installing</h3>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Drag this to your bookmarks bar, open any page, and click it to start leaving feedback. Some sites block outside
                scripts, and it only works on sites allowed below.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Bookmarklet src={widgetSrc} publicKey={project.publicKey} />
                {project.id === "demo" && (
                  <a href="/demo.html" target="_blank" className={button.outline}>
                    <ExternalLinkIcon size={14} /> Open the demo site
                  </a>
                )}
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Public key <span className="font-mono text-foreground">{project.publicKey}</span>. It&apos;s safe to expose; restrict
              where it can be used with Allowed origins.
            </p>
          </Card>
          ) : (
            <Card id="install" title={`${isProjectType(project.type) ? TYPE_META[project.type].label : "This"} projects`}>
              <p className="text-[13px] text-muted-foreground">
                The script-tag widget only runs on web pages, so there&apos;s nothing to install for this project type.
                Reviewing {project.type === "mobile" ? "mobile app builds" : project.type === "pdf" ? "uploaded PDFs" : "uploaded images"}{" "}
                isn&apos;t built yet. Change the type to Website or Web app below to get an install snippet.
              </p>
            </Card>
          )}

          <Card id="general" title="General">
            <ProjectSettingsForm project={project} canEdit={isOwner} />
          </Card>

          <Card
            id="members"
            title="Members"
            description={`${members.length} ${members.length === 1 ? "person has" : "people have"} access to this project's dashboard. Reviewers on your site don't need an account.`}
          >
            {isOwner && (
              <div className="mb-5">
                <InviteForm projectId={id} />
              </div>
            )}

            <ul className="divide-y divide-border">
              {members.map((m) => {
                const isSelf = m.userId === user.id;
                const lastOwner = m.role === "owner" && ownerCount <= 1;
                return (
                  <li key={m.userId} className="flex items-center gap-3 py-2.5">
                    <Avatar name={m.name} src={m.avatarUrl} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">
                        {m.name}
                        {isSelf && <span className="ml-1.5 font-normal text-muted-foreground">(you)</span>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                    </div>
                    {isOwner && !lastOwner ? (
                      <form action={setMemberRole}>
                        {hidden("projectId", id)}
                        {hidden("userId", m.userId)}
                        {hidden("role", m.role === "owner" ? "member" : "owner")}
                        <button
                          className={`${button.ghost} h-7`}
                          title={m.role === "owner" ? "Change to member" : "Make owner"}
                        >
                          {m.role === "owner" ? "Owner" : "Member"}
                          <span className="text-xs text-muted-foreground">⇄</span>
                        </button>
                      </form>
                    ) : (
                      <span className="px-2.5 text-[13px] text-muted-foreground" title={lastOwner ? "Every project needs an owner" : undefined}>
                        {m.role === "owner" ? "Owner" : "Member"}
                      </span>
                    )}
                    {(isOwner || isSelf) && !lastOwner && (
                      <form action={removeMember}>
                        {hidden("projectId", id)}
                        {hidden("userId", m.userId)}
                        <button className={`${button.danger} h-7`} title={isSelf ? "Leave project" : `Remove ${m.name}`}>
                          {isSelf ? "Leave" : "Remove"}
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>

            {pending.length > 0 && (
              <>
                <h3 className="mt-5 mb-1 text-xs font-medium text-muted-foreground">Pending invites</h3>
                <ul className="divide-y divide-border">
                  {pending.map((inv) => (
                    <li key={inv.id} className="flex items-center gap-3 py-2.5">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[11px] text-muted-foreground">
                        @
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{inv.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.role === "owner" ? "Owner" : "Member"} · invited {ago(inv.createdAt)} · {expiresIn(inv.expiresAt)}
                        </div>
                      </div>
                      <form action={revokeInvite}>
                        {hidden("projectId", id)}
                        {hidden("inviteId", inv.id)}
                        <button className={`${button.danger} h-7`}>Revoke</button>
                      </form>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Lost a link? Invite the same email again to get a new one; the old link stops working.
                </p>
              </>
            )}
          </Card>

          {isOwner && (
            <section className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Delete project</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Removes the project and all of its feedback for everyone. This can&apos;t be undone.
                </p>
              </div>
              <form action={deleteProject}>
                {hidden("projectId", id)}
                <button className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-destructive/10 px-3 text-[13px] font-medium text-destructive hover:bg-destructive/20">
                  <TrashIcon size={14} /> Delete
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
