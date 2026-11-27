import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Comment, Reply } from "@/db/schema";

export type CommentWithReplies = Omit<Comment, "screenshot"> & {
  hasScreenshot: boolean;
  authorAvatarUrl: string | null;
  /** True when there's activity from someone else the viewer hasn't opened yet (needs `viewerId`). */
  isNew: boolean;
  replies: Reply[];
};

const { comments, replies } = schema;

export async function listComments(opts: {
  projectId?: string;
  /** Restrict to these projects (e.g. the caller's memberships). Empty → no results. */
  projectIds?: string[];
  pageUrl?: string;
  status?: "open" | "resolved";
  /** Compute `isNew` for this user. */
  viewerId?: string;
}): Promise<CommentWithReplies[]> {
  if (opts.projectIds && opts.projectIds.length === 0) return [];
  const db = await getDb();
  const where = [];
  if (opts.projectIds) where.push(inArray(comments.projectId, opts.projectIds));
  if (opts.projectId) where.push(eq(comments.projectId, opts.projectId));
  if (opts.pageUrl) where.push(eq(comments.pageUrl, opts.pageUrl));
  if (opts.status) where.push(eq(comments.status, opts.status));

  const rows = await db
    .select({
      id: comments.id,
      projectId: comments.projectId,
      number: comments.number,
      pageUrl: comments.pageUrl,
      fullUrl: comments.fullUrl,
      selector: comments.selector,
      offsetX: comments.offsetX,
      offsetY: comments.offsetY,
      pageX: comments.pageX,
      pageY: comments.pageY,
      body: comments.body,
      authorName: comments.authorName,
      authorId: comments.authorId,
      authorAvatarUrl: schema.users.avatarUrl,
      editedAt: comments.editedAt,
      status: comments.status,
      meta: comments.meta,
      createdAt: comments.createdAt,
      screenshot: comments.screenshot,
    })
    .from(comments)
    .leftJoin(schema.users, eq(schema.users.id, comments.authorId))
    .where(and(...where))
    .orderBy(desc(comments.createdAt));

  const ids = rows.map((r) => r.id);
  const allReplies = ids.length
    ? await db.select().from(replies).where(inArray(replies.commentId, ids)).orderBy(asc(replies.createdAt))
    : [];

  const seen = new Map<string, Date>();
  if (opts.viewerId && ids.length) {
    const views = await db
      .select({ commentId: schema.commentViews.commentId, seenAt: schema.commentViews.seenAt })
      .from(schema.commentViews)
      .where(and(eq(schema.commentViews.userId, opts.viewerId), inArray(schema.commentViews.commentId, ids)));
    for (const v of views) seen.set(v.commentId, v.seenAt);
  }

  return rows.map(({ screenshot, ...r }) => {
    const thread = allReplies.filter((x) => x.commentId === r.id);
    let isNew = false;
    if (opts.viewerId) {
      // Latest message by someone else; your own comments/replies never make a thread "new" for you.
      const others = [{ authorId: r.authorId, createdAt: r.createdAt }, ...thread].filter((m) => m.authorId !== opts.viewerId);
      const latest = others.reduce<Date | null>((d, m) => (!d || m.createdAt > d ? m.createdAt : d), null);
      const s = seen.get(r.id);
      isNew = !!latest && (!s || latest > s);
    }
    return { ...r, hasScreenshot: !!screenshot, replies: thread, isNew };
  });
}

/** Projects the user owns, for the invite dialog's project list. */
export async function ownedProjects(userId: string) {
  const db = await getDb();
  return db
    .select({ id: schema.projects.id, name: schema.projects.name, icon: schema.projects.icon, color: schema.projects.color })
    .from(schema.projectMembers)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.projectMembers.projectId))
    .where(and(eq(schema.projectMembers.userId, userId), eq(schema.projectMembers.role, "owner")))
    .orderBy(asc(schema.projects.createdAt));
}

export type PendingInvite = {
  id: string;
  role: "owner" | "member";
  createdAt: Date;
  expiresAt: Date;
  project: { id: string; name: string; icon: string | null; color: string | null };
  inviter: string | null;
};

/** Records that the user opened a feedback item (so it stops showing as new). */
export async function markCommentSeen(userId: string, commentId: string) {
  const db = await getDb();
  const now = new Date();
  await db
    .insert(schema.commentViews)
    .values({ userId, commentId, seenAt: now })
    .onConflictDoUpdate({ target: [schema.commentViews.userId, schema.commentViews.commentId], set: { seenAt: now } });
}

/** Pending, unexpired invites addressed to this email (shown in the notification bell). */
export async function pendingInvitesFor(email: string): Promise<PendingInvite[]> {
  const db = await getDb();
  const { invites, projects, users } = schema;
  const rows = await db
    .select({
      id: invites.id,
      role: invites.role,
      createdAt: invites.createdAt,
      expiresAt: invites.expiresAt,
      projectId: projects.id,
      projectName: projects.name,
      icon: projects.icon,
      color: projects.color,
      inviter: users.name,
    })
    .from(invites)
    .innerJoin(projects, eq(projects.id, invites.projectId))
    .leftJoin(users, eq(users.id, invites.invitedBy))
    .where(and(eq(invites.email, email), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
    .orderBy(desc(invites.createdAt));
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    project: { id: r.projectId, name: r.projectName, icon: r.icon, color: r.color },
    inviter: r.inviter,
  }));
}
