import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";
import { sha256 } from "@/lib/auth";

/**
 * Minimal, stateless Model Context Protocol server (Streamable HTTP, JSON responses).
 * Each request is authenticated with a personal access token and scoped to the
 * projects that token's user is a member of.
 */

export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "fixes", title: "Fixes", version: "0.1.0" };
const INSTRUCTIONS =
  "Fixes collects visual website feedback. Each item (id like DEM-12) is pinned to an element on a page and has the page URL, " +
  "a CSS selector, the reviewer's comment, browser details and usually a screenshot. Typical flow: list_feedback → get_feedback → " +
  "fix the code → resolve_feedback with a short note of what changed.";

const { projects, comments, replies, projectMembers, apiTokens, users } = schema;

// ---------- auth ----------

export const TOKEN_PREFIX = "fx_";

export async function userForToken(authorization: string | null): Promise<User | null> {
  const m = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!m || !m[1].startsWith(TOKEN_PREFIX)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ tokenId: apiTokens.id, lastUsedAt: apiTokens.lastUsedAt, user: users })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(eq(apiTokens.tokenHash, sha256(m[1])));
  if (!row) return null;
  // Throttle last-used writes to once a minute.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.tokenId));
  }
  return row.user;
}

// ---------- JSON-RPC ----------

type JsonRpcId = string | number | null;
export type JsonRpcRequest = { jsonrpc: "2.0"; id?: JsonRpcId; method: string; params?: Record<string, unknown> };
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string } };

class ToolError extends Error {}

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
export const rpcError = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

/** Handles one JSON-RPC message. Returns null for notifications (no id). */
export async function handleRpc(msg: JsonRpcRequest, user: User): Promise<JsonRpcResponse | null> {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError(msg?.id ?? null, -32600, "Invalid request");
  }
  const isNotification = msg.id === undefined;
  const id = msg.id ?? null;
  try {
    switch (msg.method) {
      case "initialize": {
        const requested = String(msg.params?.protocolVersion ?? "");
        return ok(id, {
          protocolVersion: MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      }
      case "ping":
        return ok(id, {});
      case "tools/list":
        return ok(id, {
          tools: TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations })),
        });
      case "tools/call": {
        const name = String(msg.params?.name ?? "");
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);
        const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
        try {
          return ok(id, await tool.run(args, user));
        } catch (e) {
          if (e instanceof ToolError) return ok(id, { content: [{ type: "text", text: e.message }], isError: true });
          throw e;
        }
      }
      default:
        if (isNotification) return null; // notifications/initialized, notifications/cancelled, …
        return rpcError(id, -32601, `Method not found: ${msg.method}`);
    }
  } catch (e) {
    console.error("[mcp]", e);
    return isNotification ? null : rpcError(id, -32603, "Internal error");
  }
}

// ---------- tools ----------

type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
type ToolResult = { content: Content[]; structuredContent?: unknown; isError?: boolean };
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, boolean>;
  run: (args: Record<string, unknown>, user: User) => Promise<ToolResult>;
};

const text = (value: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
});

const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function memberProjects(userId: string) {
  const db = await getDb();
  return db
    .select({ id: projects.id, name: projects.name, prefix: projects.prefix, type: projects.type, role: projectMembers.role })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(eq(projectMembers.userId, userId))
    .orderBy(asc(projects.createdAt));
}

/** Matches a project by id, name or prefix (case-insensitive) among the user's projects. */
async function findProject(user: User, ref: string) {
  const mine = await memberProjects(user.id);
  const q = ref.trim().toLowerCase();
  const hits = mine.filter((p) => p.id === ref || p.name.toLowerCase() === q || p.prefix.toLowerCase() === q);
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) throw new ToolError(`"${ref}" matches several projects; use the project id. Call list_projects.`);
  throw new ToolError(`No project "${ref}" that you can access. Call list_projects.`);
}

/** Resolves "DEM-12" (or a raw comment id) to a comment in one of the user's projects. */
async function findComment(user: User, ref: unknown) {
  const key = str(ref, 100);
  if (!key) throw new ToolError("Pass the feedback id, e.g. DEM-12.");
  const mine = await memberProjects(user.id);
  if (!mine.length) throw new ToolError("You aren't a member of any project.");
  const db = await getDb();
  const m = key.match(/^([a-z]+)-(\d+)$/i);
  const where = m
    ? and(
        inArray(comments.projectId, mine.filter((p) => p.prefix.toLowerCase() === m[1].toLowerCase()).map((p) => p.id).concat("")),
        eq(comments.number, Number(m[2])),
      )
    : and(inArray(comments.projectId, mine.map((p) => p.id)), eq(comments.id, key));
  const rows = await db.select().from(comments).where(where);
  if (rows.length > 1) throw new ToolError(`"${key}" matches feedback in several projects; use the raw id from list_feedback.`);
  if (!rows.length) throw new ToolError(`No feedback "${key}" in your projects.`);
  const project = mine.find((p) => p.id === rows[0].projectId)!;
  return { comment: rows[0], project };
}

const label = (prefix: string, n: number) => `${prefix}-${n}`;

const TOOLS: Tool[] = [
  {
    name: "list_projects",
    title: "List projects",
    description: "List the Fixes projects you can access, with open/resolved feedback counts.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async run(_args, user) {
      const mine = await memberProjects(user.id);
      const db = await getDb();
      const counts = mine.length
        ? await db
            .select({ projectId: comments.projectId, status: comments.status, n: sql<number>`count(*)::int` })
            .from(comments)
            .where(inArray(comments.projectId, mine.map((p) => p.id)))
            .groupBy(comments.projectId, comments.status)
        : [];
      const count = (id: string, s: string) => counts.find((c) => c.projectId === id && c.status === s)?.n ?? 0;
      return text({
        projects: mine.map((p) => ({ ...p, open: count(p.id, "open"), resolved: count(p.id, "resolved") })),
      });
    },
  },
  {
    name: "list_feedback",
    title: "List feedback",
    description:
      "List feedback items, newest first. Filter by project (id, name or prefix), status and page URL. " +
      "Returns ids like DEM-12; call get_feedback for the full item and screenshot.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project id, name or prefix (e.g. DEM). Omit for all projects." },
        status: { type: "string", enum: ["open", "resolved", "all"], default: "open" },
        page_url: { type: "string", description: "Only feedback whose page URL contains this text." },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async run(args, user) {
      const mine = await memberProjects(user.id);
      const scope = args.project ? [await findProject(user, str(args.project, 200))] : mine;
      if (!scope.length) return text({ feedback: [], note: "You aren't a member of any project." });
      const status = args.status === "resolved" || args.status === "all" ? args.status : "open";
      const limit = Math.min(100, Math.max(1, Number(args.limit) || 25));
      const where = [inArray(comments.projectId, scope.map((p) => p.id))];
      if (status !== "all") where.push(eq(comments.status, status));
      const page = str(args.page_url, 500);
      if (page) where.push(sql`position(lower(${page}) in lower(${comments.fullUrl})) > 0`);
      const db = await getDb();
      const rows = await db
        .select({
          id: comments.id,
          projectId: comments.projectId,
          number: comments.number,
          status: comments.status,
          body: comments.body,
          author: comments.authorName,
          pageUrl: comments.fullUrl,
          selector: comments.selector,
          hasScreenshot: sql<boolean>`${comments.screenshot} is not null`,
          createdAt: comments.createdAt,
          replies: sql<number>`(select count(*)::int from replies r where r.comment_id = ${comments.id})`,
        })
        .from(comments)
        .where(and(...where))
        .orderBy(desc(comments.createdAt))
        .limit(limit);
      const byId = new Map(mine.map((p) => [p.id, p]));
      return text({
        feedback: rows.map(({ projectId, number, ...r }) => ({
          key: label(byId.get(projectId)!.prefix, number),
          project: byId.get(projectId)!.name,
          ...r,
        })),
      });
    },
  },
  {
    name: "get_feedback",
    title: "Get feedback",
    description:
      "Get one feedback item with everything needed to fix it: comment, page URL, CSS selector of the pinned element, " +
      "element text, viewport and browser, the reply thread, and the screenshot (as an image) when one exists.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Feedback id like DEM-12 (or the raw id)." },
        include_screenshot: { type: "boolean", default: true },
      },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async run(args, user) {
      const { comment: c, project } = await findComment(user, args.id);
      const db = await getDb();
      const thread = await db
        .select({ author: replies.authorName, body: replies.body, createdAt: replies.createdAt })
        .from(replies)
        .where(eq(replies.commentId, c.id))
        .orderBy(asc(replies.createdAt));
      const item = {
        key: label(project.prefix, c.number),
        id: c.id,
        project: project.name,
        status: c.status,
        body: c.body,
        author: c.authorName,
        createdAt: c.createdAt,
        pageUrl: c.fullUrl,
        selector: c.selector,
        elementText: c.meta?.elementText,
        pinOffset: { x: c.offsetX, y: c.offsetY },
        viewport: c.meta?.viewport,
        devicePixelRatio: c.meta?.devicePixelRatio,
        userAgent: c.meta?.userAgent,
        replies: thread,
        hasScreenshot: !!c.screenshot,
      };
      const result = text(item);
      const shot = c.screenshot?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
      if (shot && args.include_screenshot !== false) {
        result.content.push({ type: "image", mimeType: shot[1], data: shot[2] });
      }
      return result;
    },
  },
  {
    name: "reply_to_feedback",
    title: "Reply to feedback",
    description: "Add a reply to a feedback item's thread (e.g. to ask the reviewer a question).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Feedback id like DEM-12." },
        body: { type: "string", description: "Reply text." },
      },
      required: ["id", "body"],
      additionalProperties: false,
    },
    async run(args, user) {
      const body = str(args.body);
      if (!body) throw new ToolError("Reply body is empty.");
      const { comment: c, project } = await findComment(user, args.id);
      const db = await getDb();
      await db.insert(replies).values({ id: nanoid(12), commentId: c.id, body, authorName: user.name, authorId: user.id });
      revalidatePath("/", "layout");
      return text({ ok: true, key: label(project.prefix, c.number), replied: body });
    },
  },
  {
    name: "resolve_feedback",
    title: "Resolve feedback",
    description: "Mark a feedback item resolved, optionally adding a note describing the fix.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Feedback id like DEM-12." },
        note: { type: "string", description: "What was changed. Posted as a reply." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { idempotentHint: true },
    async run(args, user) {
      return setStatus(args, user, "resolved");
    },
  },
  {
    name: "reopen_feedback",
    title: "Reopen feedback",
    description: "Reopen a resolved feedback item, optionally with a note.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Feedback id like DEM-12." },
        note: { type: "string", description: "Why it's being reopened. Posted as a reply." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { idempotentHint: true },
    async run(args, user) {
      return setStatus(args, user, "open");
    },
  },
];

async function setStatus(args: Record<string, unknown>, user: User, status: "open" | "resolved"): Promise<ToolResult> {
  const { comment: c, project } = await findComment(user, args.id);
  const db = await getDb();
  await db.update(comments).set({ status }).where(eq(comments.id, c.id));
  const note = str(args.note);
  if (note) await db.insert(replies).values({ id: nanoid(12), commentId: c.id, body: note, authorName: user.name, authorId: user.id });
  revalidatePath("/", "layout");
  return text({ ok: true, key: label(project.prefix, c.number), status, previousStatus: c.status, note: note || undefined });
}
