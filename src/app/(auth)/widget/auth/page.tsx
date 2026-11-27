import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getUser } from "@/lib/auth";
import { originAllowed, parseOrigins } from "@/lib/origins";
import { hasGoogleAccount } from "@/lib/widget-auth";
import { Logo } from "@/components/auth-form";
import { CompleteWidgetSignIn, GoogleSignIn } from "@/components/widget-auth";

// Popup opened by the embedded widget: sign in with Google, check the person was invited to
// the project, then hand the sign-in back to the widget (which is polling for it).
//   /widget/auth?key=pk_xxx&origin=https://site.example&nonce=<random>

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-8 flex justify-center">
        <Logo size={40} />
      </div>
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-xs">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <div className="mt-2 space-y-4 text-[13px] text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function WidgetAuthPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const key = one(sp.key);
  const origin = one(sp.origin);
  const nonce = one(sp.nonce);
  const returnTo = `/widget/auth?${new URLSearchParams({ key, origin, nonce })}`;

  if (!key || !nonce || nonce.length < 20 || nonce.length > 200 || !/^https?:\/\/[^/]+$/.test(origin))
    return <Card title="Invalid sign-in link">Close this window and click Feedback on the site again.</Card>;

  const db = await getDb();
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.publicKey, key)).limit(1);
  if (!project) return <Card title="Unknown project">This site&apos;s feedback widget isn&apos;t set up correctly.</Card>;
  if (!originAllowed(origin, parseOrigins(project.allowedOrigins)))
    return (
      <Card title="Site not allowed">
        <p>
          <span className="font-medium text-foreground">{origin}</span> isn&apos;t one of {project.name}&apos;s allowed origins.
        </p>
      </Card>
    );

  const site = new URL(origin).host;
  const intro = (
    <p>
      Sign in to leave feedback on <span className="font-medium text-foreground">{site}</span>. Only people invited to{" "}
      <span className="font-medium text-foreground">{project.name}</span> can comment.
    </p>
  );
  const googleFailed = one(sp.error) === "google_failed" && (
    <p role="alert" className="text-destructive">
      Google sign-in didn&apos;t complete. Please try again.
    </p>
  );

  let user;
  try {
    user = await getUser();
  } catch (e) {
    return <Card title="Couldn't sign you in">{(e as Error).message}</Card>;
  }
  if (!user)
    return (
      <Card title="Sign in to comment">
        {intro}
        {googleFailed}
        <GoogleSignIn returnTo={returnTo} />
      </Card>
    );

  if (!(await hasGoogleAccount()))
    return (
      <Card title="Google sign-in required">
        {intro}
        <p>
          You&apos;re signed in to Fixes as <span className="font-medium text-foreground">{user.email}</span> without Google.
        </p>
        <GoogleSignIn returnTo={returnTo} switchAccount />
      </Card>
    );

  // Read-only check here; the completion action re-checks and accepts a pending invite.
  const [member] = await db
    .select({ role: schema.projectMembers.role })
    .from(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, project.id), eq(schema.projectMembers.userId, user.id)));
  const [invite] = member
    ? []
    : await db
        .select({ id: schema.invites.id })
        .from(schema.invites)
        .where(
          and(
            eq(schema.invites.projectId, project.id),
            eq(schema.invites.email, user.email),
            isNull(schema.invites.acceptedAt),
            gt(schema.invites.expiresAt, new Date()),
          ),
        )
        .limit(1);

  if (!member && !invite)
    return (
      <Card title="You haven't been invited">
        <p>
          <span className="font-medium text-foreground">{user.email}</span> isn&apos;t a member of{" "}
          <span className="font-medium text-foreground">{project.name}</span>. Ask a project owner to invite this address, or use
          the Google account you were invited with.
        </p>
        <GoogleSignIn returnTo={returnTo} switchAccount label="Use a different Google account" />
      </Card>
    );

  return (
    <Card title="Signed in">
      <CompleteWidgetSignIn projectKey={key} origin={origin} nonce={nonce} />
    </Card>
  );
}
