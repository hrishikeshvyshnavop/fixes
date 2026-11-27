import { and, eq, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireWidgetUser } from "@/lib/widget-auth";
import { REACTION_EMOJI } from "@/lib/widget-data";
import { ApiError, handle, json, preflight, projectForKey } from "@/lib/widget-api";

export const OPTIONS = preflight;

// POST /api/widget/reactions  { key, targetId, emoji }  — toggles the viewer's reaction
// on a comment or reply in this project.
export function POST(req: Request) {
  return handle(req, async () => {
    const b = await req.json().catch(() => ({}));
    const project = await projectForKey(req, b.key);
    const user = await requireWidgetUser(req, project);
    if (typeof b.targetId !== "string" || !b.targetId) throw new ApiError(400, "targetId is required");
    if (!REACTION_EMOJI.includes(b.emoji)) throw new ApiError(400, "Unsupported reaction");

    const db = await getDb();
    // The target is either a thread's root comment or one of its replies.
    const [thread] = await db
      .select({ id: schema.comments.id })
      .from(schema.comments)
      .leftJoin(schema.replies, eq(schema.replies.commentId, schema.comments.id))
      .where(and(eq(schema.comments.projectId, project.id), or(eq(schema.comments.id, b.targetId), eq(schema.replies.id, b.targetId))))
      .limit(1);
    if (!thread) throw new ApiError(404, "Comment not found");

    const key = and(eq(schema.reactions.targetId, b.targetId), eq(schema.reactions.userId, user.id), eq(schema.reactions.emoji, b.emoji));
    const removed = await db.delete(schema.reactions).where(key).returning({ emoji: schema.reactions.emoji });
    if (!removed.length)
      await db
        .insert(schema.reactions)
        .values({ commentId: thread.id, targetId: b.targetId, userId: user.id, emoji: b.emoji })
        .onConflictDoNothing();
    return json(req, { on: !removed.length });
  });
}
