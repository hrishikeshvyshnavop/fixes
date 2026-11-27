import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, schema } from "@/db";
import type { CommentMeta } from "@/db/schema";
import { listComments } from "@/lib/queries";
import { handle, json, markWidgetSeen, normalisePageUrl, num, preflight, projectForKey, str, ApiError } from "@/lib/widget-api";

export const OPTIONS = preflight;

// GET /api/widget/comments?key=pk_xxx&url=https://site/page
export function GET(req: Request) {
  return handle(req, async () => {
    const { searchParams } = new URL(req.url);
    const project = await projectForKey(req, searchParams.get("key"));
    const fullUrl = str(searchParams.get("url"), "url", 2048);
    const pageUrl = normalisePageUrl(fullUrl);
    // The widget calls this on every page load, so it doubles as an install heartbeat.
    await markWidgetSeen(project.id, fullUrl);
    return json(req, { comments: await listComments({ projectId: project.id, pageUrl }) });
  });
}

const MAX_SCREENSHOT = 3_000_000; // ~2.2MB of JPEG once base64-decoded

export function POST(req: Request) {
  return handle(req, async () => {
    const b = await req.json().catch(() => {
      throw new ApiError(400, "Invalid JSON");
    });
    const project = await projectForKey(req, b.key);
    const fullUrl = str(b.url, "url", 2048);

    let screenshot: string | null = null;
    if (b.screenshot != null) {
      if (typeof b.screenshot !== "string" || !b.screenshot.startsWith("data:image/"))
        throw new ApiError(400, "screenshot must be an image data URL");
      if (b.screenshot.length > MAX_SCREENSHOT) throw new ApiError(413, "screenshot is too large");
      screenshot = b.screenshot;
    }

    const meta: CommentMeta = typeof b.meta === "object" && b.meta ? b.meta : {};
    const row = {
      id: nanoid(12),
      projectId: project.id,
      number: sql<number>`(SELECT coalesce(max(number), 0) + 1 FROM comments WHERE project_id = ${project.id})`,
      pageUrl: normalisePageUrl(fullUrl),
      fullUrl,
      selector: str(b.selector, "selector", 2000),
      offsetX: num(b.offsetX, "offsetX"),
      offsetY: num(b.offsetY, "offsetY"),
      pageX: num(b.pageX, "pageX"),
      pageY: num(b.pageY, "pageY"),
      body: str(b.body, "body", 5000),
      authorName: str(b.authorName, "authorName", 100),
      screenshot,
      meta: {
        userAgent: req.headers.get("user-agent") ?? undefined,
        viewport: meta.viewport,
        scroll: meta.scroll,
        devicePixelRatio: meta.devicePixelRatio,
        elementText: typeof meta.elementText === "string" ? meta.elementText.slice(0, 200) : undefined,
      },
    };

    const db = await getDb();
    const [created] = await db.insert(schema.comments).values(row).returning();
    const { screenshot: shot, ...rest } = created;
    return json(req, { comment: { ...rest, hasScreenshot: !!shot, replies: [] } }, 201);
  });
}
