import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { acceptInvite, logout } from "@/app/auth-actions";
import { getUser, sha256 } from "@/lib/auth";
import { hue } from "@/lib/ui";
import { Swatch } from "@/components/sidebar-nav";
import { button } from "@/components/styles";
import { Logo } from "@/components/auth-form";

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-8 flex justify-center">
        <Logo size={40} />
      </div>
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-xs">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <div className="mt-2 text-[13px] text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const [row] = await db
    .select({ invite: schema.invites, project: schema.projects, inviter: schema.users.name })
    .from(schema.invites)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.invites.projectId))
    .leftJoin(schema.users, eq(schema.users.id, schema.invites.invitedBy))
    .where(eq(schema.invites.tokenHash, sha256(token)));

  if (!row) return <Card title="Invite not found">This link is invalid or has been revoked. Ask for a new invite.</Card>;
  const { invite, project, inviter } = row;
  if (invite.expiresAt < new Date())
    return <Card title="Invite expired">This invite has expired. Ask {inviter ?? "the project owner"} for a new link.</Card>;

  const user = await getUser();
  if (user) {
    const [member] = await db
      .select({ role: schema.projectMembers.role })
      .from(schema.projectMembers)
      .where(and(eq(schema.projectMembers.projectId, project.id), eq(schema.projectMembers.userId, user.id)));
    if (member)
      return (
        <Card title="You're already a member">
          <Link href={`/projects/${project.id}`} className={`${button.primary} mt-4`}>
            Open {project.name}
          </Link>
        </Card>
      );
  }
  if (invite.acceptedAt) return <Card title="Invite already used">This invite link has already been accepted.</Card>;

  const next = `/invite/${token}`;
  const header = (
    <>
      <div className="mb-4 flex justify-center">
        <Swatch name={project.name} hue={hue(project.id)} icon={project.icon} color={project.color} size={40} />
      </div>
      Join <span className="text-foreground">{project.name}</span>
    </>
  );

  if (!user)
    return (
      <Card title={header}>
        <p>
          {inviter ?? "Someone"} invited <span className="font-medium text-foreground">{invite.email}</span> as{" "}
          {invite.role === "owner" ? "an owner" : "a member"}.
        </p>
        <div className="mt-6 grid gap-2">
          <Link href={`/signup?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invite.email)}`} className={button.primary}>
            Create account to join
          </Link>
          <Link href={`/login?next=${encodeURIComponent(next)}`} className={button.outline}>
            I already have an account
          </Link>
        </div>
      </Card>
    );

  if (user.email !== invite.email)
    return (
      <Card title="Wrong account">
        <p>
          This invite is for <span className="font-medium text-foreground">{invite.email}</span>, but you&apos;re signed in as{" "}
          <span className="font-medium text-foreground">{user.email}</span>.
        </p>
        <form action={logout} className="mt-6">
          <button className={`${button.outline} w-full`}>Sign out and switch account</button>
        </form>
      </Card>
    );

  return (
    <Card title={header}>
      <p>
        {inviter ?? "Someone"} invited you as {invite.role === "owner" ? "an owner" : "a member"}.
      </p>
      <form action={acceptInvite} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <button className={`${button.primary} w-full`}>Accept invite</button>
      </form>
    </Card>
  );
}
