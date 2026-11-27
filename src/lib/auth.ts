import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { and, eq, ne, notExists, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Project, Role, User } from "@/db/schema";
import { auth } from "@/lib/neon-auth";

// ---------- tokens (invite links) ----------

export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// ---------- sessions (Neon Auth) ----------

type AuthUser = { id: string; email: string; name?: string | null; emailVerified?: boolean };

/**
 * Mirror a Neon Auth user into the app's `users` table (same id), which project membership,
 * invites and replies reference. Creates the row on first sight.
 */
export async function syncUser(au: AuthUser): Promise<User> {
  const db = await getDb();
  const email = au.email.toLowerCase();
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.id, au.id));
  if (existing) {
    if (existing.email === email) return existing;
    const [updated] = await db.update(schema.users).set({ email }).where(eq(schema.users.id, au.id)).returning();
    return updated;
  }

  const name = (au.name || email.split("@")[0]).slice(0, 100);
  const [legacy] = await db.select().from(schema.users).where(and(eq(schema.users.email, email), ne(schema.users.id, au.id)));
  if (legacy) {
    // An account from before Neon Auth with this email. Only take over its projects once Neon
    // has verified the address; otherwise anyone could sign up with someone else's email.
    if (!au.emailVerified) throw new Error("Verify your email address to access your existing projects.");
    const user = await db.transaction(async (tx) => {
      await tx.update(schema.users).set({ email: `migrated+${legacy.id}@invalid` }).where(eq(schema.users.id, legacy.id));
      const [created] = await tx.insert(schema.users).values({ id: au.id, email, name: legacy.name }).returning();
      await tx.update(schema.projectMembers).set({ userId: au.id }).where(eq(schema.projectMembers.userId, legacy.id));
      await tx.update(schema.invites).set({ invitedBy: au.id }).where(eq(schema.invites.invitedBy, legacy.id));
      await tx.delete(schema.users).where(eq(schema.users.id, legacy.id));
      return created;
    });
    return user;
  }

  const [created] = await db.insert(schema.users).values({ id: au.id, email, name }).onConflictDoNothing().returning();
  if (!created) {
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, au.id));
    return row;
  }
  await claimOrphansIfFirstUser(created.id);
  return created;
}

/** Current user, or null. Cached per request. */
export const getUser = cache(async (): Promise<User | null> => {
  const { data } = await auth.getSession();
  if (!data?.user) return null;
  return syncUser(data.user);
});

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The first account on an install becomes owner of every project nobody belongs to yet
 * (projects created before accounts existed, and the demo project).
 */
async function claimOrphansIfFirstUser(userId: string) {
  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(schema.users);
  if (n !== 1) return;
  const orphans = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      notExists(db.select({ x: sql`1` }).from(schema.projectMembers).where(eq(schema.projectMembers.projectId, schema.projects.id))),
    );
  if (orphans.length)
    await db.insert(schema.projectMembers).values(orphans.map((p) => ({ projectId: p.id, userId, role: "owner" as const })));
}

// ---------- project access ----------

export type Access = { user: User; project: Project; role: Role };

/** Project + the caller's role. 404s for non-members so project ids don't leak. */
export const getAccess = cache(async (projectId: string): Promise<Access> => {
  const user = await requireUser();
  const db = await getDb();
  const [row] = await db
    .select({ project: schema.projects, role: schema.projectMembers.role })
    .from(schema.projectMembers)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.projectMembers.projectId))
    .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, user.id)))
    .limit(1);
  if (!row) notFound();
  return { user, project: row.project, role: row.role };
});

export async function requireOwner(projectId: string): Promise<Access> {
  const access = await getAccess(projectId);
  if (access.role !== "owner") throw new Error("Only project owners can do that");
  return access;
}

/** Ids of every project the user belongs to. */
export async function memberProjectIds(userId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.projectMembers.projectId })
    .from(schema.projectMembers)
    .where(eq(schema.projectMembers.userId, userId));
  return rows.map((r) => r.id);
}

/** Only allow same-site relative redirects after login. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/";
}
