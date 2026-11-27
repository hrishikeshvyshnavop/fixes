import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireWidgetUser } from "@/lib/widget-auth";
import { ApiError, handle, json, num, preflight, projectForKey, str } from "@/lib/widget-api";

export const OPTIONS = preflight;

// PATCH /api/widget/comments/:id  { key, status: "open" | "resolved" }  — any member
// PATCH /api/widget/comments/:id  { key, body }                          — author only
export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const project = await projectForKey(req, b.key);
    const user = await requireWidgetUser(req, project);
    const db = await getDb();
    const where = and(eq(schema.comments.id, id), eq(schema.comments.projectId, project.id));

    // Re-anchor the pin to another element (drag & drop in the widget) — author or project owner.
    if (b.move !== undefined) {
      const [c] = await db.select({ authorId: schema.comments.authorId }).from(schema.comments).where(where);
      if (!c) throw new ApiError(404, "Comment not found");
      if (c.authorId !== user.id && user.role !== "owner") throw new ApiError(403, "Only the author or a project owner can move this");
      const m = typeof b.move === "object" && b.move ? b.move : {};
      const unit = (v: unknown, f: string) => Math.min(1, Math.max(0, num(v, f)));
      const [updated] = await db
        .update(schema.comments)
        .set({
          selector: str(m.selector, "selector", 2000),
          offsetX: unit(m.offsetX, "offsetX"),
          offsetY: unit(m.offsetY, "offsetY"),
          pageX: num(m.pageX, "pageX"),
          pageY: num(m.pageY, "pageY"),
        })
        .where(where)
        .returning({ id: schema.comments.id, selector: schema.comments.selector });
      return json(req, updated);
    }

    if (b.body !== undefined) {
      const [c] = await db.select({ authorId: schema.comments.authorId }).from(schema.comments).where(where);
      if (!c) throw new ApiError(404, "Comment not found");
      if (c.authorId !== user.id) throw new ApiError(403, "You can only edit your own comments");
      const [updated] = await db
        .update(schema.comments)
        .set({ body: str(b.body, "body", 5000), editedAt: new Date() })
        .where(where)
        .returning({ id: schema.comments.id, body: schema.comments.body, editedAt: schema.comments.editedAt });
      return json(req, updated);
    }

    if (b.status !== "open" && b.status !== "resolved") throw new ApiError(400, "Invalid status");
    const [updated] = await db
      .update(schema.comments)
      .set({ status: b.status })
      .where(where)
      .returning({ id: schema.comments.id, status: schema.comments.status });
    if (!updated) throw new ApiError(404, "Comment not found");
    return json(req, updated);
  });
}

// DELETE /api/widget/comments/:id?key=pk_xxx  — author or project owner; removes the whole thread
export function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const { id } = await params;
    const project = await projectForKey(req, new URL(req.url).searchParams.get("key"));
    const user = await requireWidgetUser(req, project);
    const db = await getDb();
    const where = and(eq(schema.comments.id, id), eq(schema.comments.projectId, project.id));
    const [c] = await db.select({ authorId: schema.comments.authorId }).from(schema.comments).where(where);
    if (!c) throw new ApiError(404, "Comment not found");
    if (c.authorId !== user.id && user.role !== "owner") throw new ApiError(403, "Only the author or a project owner can delete this");
    await db.delete(schema.comments).where(where);
    return json(req, { ok: true });
  });
}
