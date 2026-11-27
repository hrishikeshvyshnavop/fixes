import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, schema } from "@/db";
import type { Project, User } from "@/db/schema";
import { newToken, sha256 } from "@/lib/auth";
import { auth } from "@/lib/neon-auth";
import { ApiError } from "@/lib/widget-api";

const PENDING_MS = 10 * 60_000; // popup → widget hand-off window
const SESSION_MS = 30 * 24 * 3600_000; // how long a widget stays signed in

export type WidgetUser = Pick<User, "id" | "name" | "email">;

/** Does the current Neon Auth session have a Google account linked? */
export async function hasGoogleAccount(): Promise<boolean> {
  try {
    const { data } = await auth.listAccounts();
    const list = Array.isArray(data) ? data : [];
    return list.some((a: { providerId?: string }) => a?.providerId === "google");
  } catch (e) {
    console.error("[widget-auth] listAccounts", e);
    return false;
  }
}

/**
 * Is this user allowed to comment on the project? Members are. Someone with a pending,
 * unexpired invite for their (Google-verified) email is accepted into the project on the spot.
 */
export async function ensureCommenter(user: User, projectId: string): Promise<boolean> {
  const db = await getDb();
  const [member] = await db
    .select({ role: schema.projectMembers.role })
    .from(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, user.id)));
  if (member) return true;

  const [invite] = await db
    .select()
    .from(schema.invites)
    .where(
      and(
        eq(schema.invites.projectId, projectId),
        eq(schema.invites.email, user.email),
        isNull(schema.invites.acceptedAt),
        gt(schema.invites.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!invite) return false;
  await db.insert(schema.projectMembers).values({ projectId, userId: user.id, role: invite.role }).onConflictDoNothing();
  await db.update(schema.invites).set({ acceptedAt: new Date() }).where(eq(schema.invites.id, invite.id));
  return true;
}

/** Popup side: record that this user signed in for the widget instance holding `nonce`. */
export async function createPendingSession(opts: { user: User; project: Project; origin: string; nonce: string }) {
  const db = await getDb();
  const nonceHash = sha256(opts.nonce);
  await db
    .insert(schema.widgetSessions)
    .values({
      id: nanoid(16),
      nonceHash,
      userId: opts.user.id,
      projectId: opts.project.id,
      origin: opts.origin,
      expiresAt: new Date(Date.now() + PENDING_MS),
    })
    .onConflictDoUpdate({
      target: schema.widgetSessions.nonceHash,
      set: { userId: opts.user.id, projectId: opts.project.id, origin: opts.origin, expiresAt: new Date(Date.now() + PENDING_MS) },
    });
}

/** Widget side: swap a nonce for a bearer token. Returns null while the popup hasn't finished. */
export async function claimSession(req: Request, project: Project, nonce: string): Promise<{ token: string; user: WidgetUser } | null> {
  const origin = req.headers.get("origin");
  if (!origin) throw new ApiError(400, "Missing Origin header");
  const db = await getDb();
  const token = newToken();
  const [row] = await db
    .update(schema.widgetSessions)
    .set({ tokenHash: sha256(token), nonceHash: null, expiresAt: new Date(Date.now() + SESSION_MS) })
    .where(
      and(
        eq(schema.widgetSessions.nonceHash, sha256(nonce)),
        eq(schema.widgetSessions.projectId, project.id),
        eq(schema.widgetSessions.origin, origin),
        isNull(schema.widgetSessions.tokenHash),
        gt(schema.widgetSessions.expiresAt, new Date()),
      ),
    )
    .returning({ userId: schema.widgetSessions.userId });
  if (!row) return null;
  const [user] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, row.userId));
  return { token, user };
}

const bearer = (req: Request) => {
  const m = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  return m?.[1] ?? null;
};

/**
 * The signed-in widget user, or null. A token only works for the project it was issued for,
 * and stops working as soon as the person is removed from the project.
 */
export async function widgetUser(req: Request, project: Project): Promise<WidgetUser | null> {
  const token = bearer(req);
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.widgetSessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.widgetSessions.userId))
    .innerJoin(
      schema.projectMembers,
      and(eq(schema.projectMembers.userId, schema.widgetSessions.userId), eq(schema.projectMembers.projectId, schema.widgetSessions.projectId)),
    )
    .where(
      and(
        eq(schema.widgetSessions.tokenHash, sha256(token)),
        eq(schema.widgetSessions.projectId, project.id),
        gt(schema.widgetSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function requireWidgetUser(req: Request, project: Project): Promise<WidgetUser> {
  const user = await widgetUser(req, project);
  if (!user) throw new ApiError(401, "Sign in with Google to comment");
  return user;
}

export async function endSession(req: Request) {
  const token = bearer(req);
  if (!token) return;
  const db = await getDb();
  await db.delete(schema.widgetSessions).where(eq(schema.widgetSessions.tokenHash, sha256(token)));
}
