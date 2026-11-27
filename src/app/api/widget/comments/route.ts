import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, schema } from "@/db";
import type { CommentMeta } from "@/db/schema";
import { widgetThreads } from "@/lib/widget-data";
import { requireWidgetUser, widgetUser } from "@/lib/widget-auth";
import { handle, json, markWidgetSeen, normalisePageUrl, num, preflight, projectForKey, str, ApiError } from "@/lib/widget-api";

export const OPTIONS = preflight;

// GET /api/widget/comments?key=pk_xxx&url=https://site/page[&scope=all]
// scope=all lists threads from every page of the project (the widget's inbox).
export function GET(req: Request) {
  return handle(req, async () => {
    const { searchParams } = new URL(req.url);
    const project = await projectForKey(req, searchParams.get("key"));
    const fullUrl = str(searchParams.get("url"), "url", 2048);
    const pageUrl = normalisePageUrl(fullUrl);
    // The widget calls this on every page load, so it doubles as an install heartbeat.
    await markWidgetSeen(project.id, fullUrl);
    // Comments are only visible to signed-in, invited project members.
    const user = await widgetUser(req, project);
    if (!user) return json(req, { comments: [], user: null });
    const all = searchParams.get("scope") === "all";
    return json(req, {
      comments: await widgetThreads(project.id, user.id, all ? undefined : pageUrl),
      user,
      project: { name: project.name, prefix: project.prefix },
    });
  });
}

const MAX_SCREENSHOT = 3_000_000; // ~2.2MB of JPEG once base64-decoded

export function POST(req: Request) {
  return handle(req, async () => {
    const b = await req.json().catch(() => {
      throw new ApiError(400, "Invalid JSON");
    });
    const project = await projectForKey(req, b.key);
    const user = await requireWidgetUser(req, project);
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
      authorName: user.name,
      authorId: user.id,
      screenshot,
      meta: {
        userAgent: req.headers.get("user-agent") ?? undefined,
        viewport: meta.viewport,
        scroll: meta.scroll,
        devicePixelRatio: meta.devicePixelRatio,
        elementText: typeof meta.elementText === "string" ? meta.elementText.slice(0, 200) : undefined,
        element: typeof meta.element === "string" ? meta.element.slice(0, 200) : undefined,
        quote: typeof meta.quote === "string" && meta.quote.trim() ? meta.quote.trim().slice(0, 500) : undefined,
      },
    };

    const db = await getDb();
    const [created] = await db.insert(schema.comments).values(row).returning();
    const { screenshot: shot, ...rest } = created;
    return json(req, { comment: { ...rest, hasScreenshot: !!shot, reactions: [], replies: [] } }, 201);
  });
}
