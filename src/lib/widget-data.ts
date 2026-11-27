import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { listComments, type CommentWithReplies } from "@/lib/queries";

/** Reactions the widget offers. Anything else is rejected. */
export const REACTION_EMOJI = ["👍", "❤️", "😄", "🎉", "👀", "🚀", "✅", "🔥"];

export type ReactionSummary = { emoji: string; count: number; mine: boolean; names: string[] };

export type WidgetThread = Omit<CommentWithReplies, "replies"> & {
  reactions: ReactionSummary[];
  replies: (CommentWithReplies["replies"][number] & { reactions: ReactionSummary[]; authorAvatarUrl: string | null })[];
};

/** Threads for the widget: comments + replies + reaction summaries from the viewer's point of view. */
export async function widgetThreads(projectId: string, viewerId: string, pageUrl?: string): Promise<WidgetThread[]> {
  const list = await listComments({ projectId, pageUrl });
  if (!list.length) return [];
  const db = await getDb();
  const rows = await db
    .select({
      targetId: schema.reactions.targetId,
      emoji: schema.reactions.emoji,
      userId: schema.reactions.userId,
      name: schema.users.name,
    })
    .from(schema.reactions)
    .innerJoin(schema.users, eq(schema.users.id, schema.reactions.userId))
    .where(inArray(schema.reactions.commentId, list.map((c) => c.id)))
    .orderBy(asc(schema.reactions.createdAt));

  const byTarget = new Map<string, ReactionSummary[]>();
  for (const r of rows) {
    const list = byTarget.get(r.targetId) ?? [];
    let s = list.find((x) => x.emoji === r.emoji);
    if (!s) list.push((s = { emoji: r.emoji, count: 0, mine: false, names: [] }));
    s.count++;
    s.names.push(r.name);
    if (r.userId === viewerId) s.mine = true;
    byTarget.set(r.targetId, list);
  }
  // Profile photos for reply authors (comment authors' come with listComments).
  const replyAuthors = [...new Set(list.flatMap((c) => c.replies.map((r) => r.authorId)).filter((x): x is string => !!x))];
  const photos = new Map<string, string | null>();
  if (replyAuthors.length)
    for (const u of await db
      .select({ id: schema.users.id, avatarUrl: schema.users.avatarUrl })
      .from(schema.users)
      .where(inArray(schema.users.id, replyAuthors)))
      photos.set(u.id, u.avatarUrl);

  return list.map((c) => ({
    ...c,
    reactions: byTarget.get(c.id) ?? [],
    replies: c.replies.map((r) => ({
      ...r,
      reactions: byTarget.get(r.id) ?? [],
      authorAvatarUrl: (r.authorId && photos.get(r.authorId)) || null,
    })),
  }));
}

/** Members who can be @mentioned in the widget. */
export async function projectMembersForWidget(projectId: string) {
  const db = await getDb();
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, avatarUrl: schema.users.avatarUrl })
    .from(schema.projectMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.projectMembers.userId))
    .where(eq(schema.projectMembers.projectId, projectId))
    .orderBy(asc(schema.users.name));
}
