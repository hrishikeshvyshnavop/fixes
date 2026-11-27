import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, schema } from "@/db";
import { ApiError, handle, json, preflight, projectForKey, str } from "@/lib/widget-api";

export const OPTIONS = preflight;

// POST /api/widget/comments/:id/replies  { key, body, authorName }
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const project = await projectForKey(req, b.key);

    const db = await getDb();
    const [parent] = await db
      .select({ id: schema.comments.id })
      .from(schema.comments)
      .where(and(eq(schema.comments.id, id), eq(schema.comments.projectId, project.id)))
      .limit(1);
    if (!parent) throw new ApiError(404, "Comment not found");

    const [reply] = await db
      .insert(schema.replies)
      .values({
        id: nanoid(12),
        commentId: id,
        body: str(b.body, "body", 5000),
        authorName: str(b.authorName, "authorName", 100),
      })
      .returning();
    return json(req, { reply }, 201);
  });
}
