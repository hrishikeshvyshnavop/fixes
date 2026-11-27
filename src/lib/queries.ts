import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Comment, Reply } from "@/db/schema";

export type CommentWithReplies = Omit<Comment, "screenshot"> & {
  hasScreenshot: boolean;
  replies: Reply[];
};

const { comments, replies } = schema;

export async function listComments(opts: {
  projectId?: string;
  /** Restrict to these projects (e.g. the caller's memberships). Empty → no results. */
  projectIds?: string[];
  pageUrl?: string;
  status?: "open" | "resolved";
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
      status: comments.status,
      meta: comments.meta,
      createdAt: comments.createdAt,
      screenshot: comments.screenshot,
    })
    .from(comments)
    .where(and(...where))
    .orderBy(desc(comments.createdAt));

  const ids = rows.map((r) => r.id);
  const allReplies = ids.length
    ? await db.select().from(replies).where(inArray(replies.commentId, ids)).orderBy(asc(replies.createdAt))
    : [];

  return rows.map(({ screenshot, ...r }) => ({
    ...r,
    hasScreenshot: !!screenshot,
    replies: allReplies.filter((x) => x.commentId === r.id),
  }));
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
