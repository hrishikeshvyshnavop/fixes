import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getUser } from "@/lib/auth";

// Dashboard-only: the caller must be a member of the comment's project.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const db = await getDb();
  const [row] = await db
    .select({ screenshot: schema.comments.screenshot })
    .from(schema.comments)
    .innerJoin(
      schema.projectMembers,
      and(eq(schema.projectMembers.projectId, schema.comments.projectId), eq(schema.projectMembers.userId, user.id)),
    )
    .where(eq(schema.comments.id, id));
  const m = row?.screenshot?.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
