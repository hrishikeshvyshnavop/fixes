import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Project } from "@/db/schema";
import { requireWidgetUser } from "@/lib/widget-auth";
import { ApiError, handle, json, preflight, projectForKey, str } from "@/lib/widget-api";

export const OPTIONS = preflight;

async function findReply(id: string, project: Project) {
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.replies.id, authorId: schema.replies.authorId })
    .from(schema.replies)
    .innerJoin(schema.comments, eq(schema.comments.id, schema.replies.commentId))
    .where(and(eq(schema.replies.id, id), eq(schema.comments.projectId, project.id)));
  if (!row) throw new ApiError(404, "Reply not found");
  return row;
}

// PATCH /api/widget/replies/:id  { key, body }  — author only
export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const project = await projectForKey(req, b.key);
    const user = await requireWidgetUser(req, project);
    const reply = await findReply(id, project);
    if (reply.authorId !== user.id) throw new ApiError(403, "You can only edit your own replies");
    const db = await getDb();
    const [updated] = await db
      .update(schema.replies)
      .set({ body: str(b.body, "body", 5000), editedAt: new Date() })
      .where(eq(schema.replies.id, id))
      .returning({ id: schema.replies.id, body: schema.replies.body, editedAt: schema.replies.editedAt });
    return json(req, updated);
  });
}

// DELETE /api/widget/replies/:id?key=pk_xxx  — author or project owner
export function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const { id } = await params;
    const project = await projectForKey(req, new URL(req.url).searchParams.get("key"));
    const user = await requireWidgetUser(req, project);
    const reply = await findReply(id, project);
    if (reply.authorId !== user.id && user.role !== "owner") throw new ApiError(403, "Only the author or a project owner can delete this");
    const db = await getDb();
    await db.delete(schema.replies).where(eq(schema.replies.id, id));
    await db.delete(schema.reactions).where(eq(schema.reactions.targetId, id));
    return json(req, { ok: true });
  });
}
