import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireWidgetUser } from "@/lib/widget-auth";
import { ApiError, handle, json, preflight, projectForKey } from "@/lib/widget-api";

export const OPTIONS = preflight;

// PATCH /api/widget/comments/:id  { key, status: "open" | "resolved" }
export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const project = await projectForKey(req, b.key);
    await requireWidgetUser(req, project);
    if (b.status !== "open" && b.status !== "resolved") throw new ApiError(400, "Invalid status");

    const db = await getDb();
    const [updated] = await db
      .update(schema.comments)
      .set({ status: b.status })
      .where(and(eq(schema.comments.id, id), eq(schema.comments.projectId, project.id)))
      .returning({ id: schema.comments.id, status: schema.comments.status });
    if (!updated) throw new ApiError(404, "Comment not found");
    return json(req, updated);
  });
}
