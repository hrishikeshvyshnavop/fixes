import "server-only";
import { and, eq, isNull, lt, ne, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import type { Project } from "@/db/schema";
import { originAllowed, parseOrigins } from "./origins";

export function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    // Chrome's Private Network Access: lets public sites call a Fixes server on localhost/LAN during testing.
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin",
  };
}

export function json(req: Request, data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders(req.headers.get("origin")) });
}

export function preflight(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Resolve the project for a public key and enforce its origin allow-list. */
export async function projectForKey(req: Request, key: unknown): Promise<Project> {
  if (typeof key !== "string" || !key) throw new ApiError(400, "Missing project key");
  const db = await getDb();
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.publicKey, key))
    .limit(1);
  if (!project) throw new ApiError(404, "Unknown project key");

  const allowed = parseOrigins(project.allowedOrigins);
  const origin = req.headers.get("origin");
  if (origin && !originAllowed(origin, allowed)) {
    // Remember it so the install card can say "loaded on X, which isn't allowed".
    await db
      .update(schema.projects)
      .set({ widgetBlockedAt: new Date(), widgetBlockedOrigin: origin.slice(0, 300) })
      .where(eq(schema.projects.id, project.id));
    throw new ApiError(403, `Origin ${origin} is not allowed for this project`);
  }
  return project;
}

/** Record a widget check-in (throttled to one write per minute per project). */
export async function markWidgetSeen(projectId: string, pageUrl: string) {
  const db = await getDb();
  await db
    .update(schema.projects)
    .set({ widgetSeenAt: new Date(), widgetSeenUrl: pageUrl.slice(0, 2048) })
    .where(
      and(
        eq(schema.projects.id, projectId),
        or(isNull(schema.projects.widgetSeenAt), lt(schema.projects.widgetSeenAt, new Date(Date.now() - 60_000)), ne(schema.projects.widgetSeenUrl, pageUrl.slice(0, 2048))),
      ),
    );
}

export function str(v: unknown, field: string, max: number): string {
  if (typeof v !== "string" || !v.trim()) throw new ApiError(400, `${field} is required`);
  if (v.length > max) throw new ApiError(413, `${field} is too long`);
  return v.trim();
}

export function num(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ApiError(400, `${field} must be a number`);
  return v;
}

export async function handle(req: Request, fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return json(req, { error: e.message }, e.status);
    console.error(e);
    return json(req, { error: "Internal error" }, 500);
  }
}

/** origin + pathname, so query strings / hashes don't split a page's comments. */
export function normalisePageUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + (u.pathname.replace(/\/$/, "") || "/");
  } catch {
    throw new ApiError(400, "Invalid page URL");
  }
}
