import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

// Serves uploaded profile photos. Public so they also render in the widget on customers' sites;
// URLs carry ?v=<timestamp>, so each version can be cached forever.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [row] = await db.select().from(schema.userAvatars).where(eq(schema.userAvatars.userId, id));
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(row.data, "base64"), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
