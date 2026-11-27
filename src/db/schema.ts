import { pgTable, text, timestamp, jsonb, real, index, integer, primaryKey } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // Short identifier used in feedback ids (DEM-12). Stable across renames.
  prefix: text("prefix").notNull(),
  // "lucide:<id>" or "emoji:<char>"; null = letter badge.
  icon: text("icon"),
  color: text("color"), // #rrggbb
  summary: text("summary").notNull().default(""),
  description: text("description").notNull().default(""),
  // website | webapp | mobile | image | pdf
  type: text("type").notNull().default("website"),
  // Install health (written by the public widget API).
  widgetSeenAt: timestamp("widget_seen_at", { withTimezone: true }),
  widgetSeenUrl: text("widget_seen_url"),
  widgetBlockedAt: timestamp("widget_blocked_at", { withTimezone: true }),
  widgetBlockedOrigin: text("widget_blocked_origin"),
  // Public key embedded in the widget script tag. Not a secret.
  publicKey: text("public_key").notNull().unique(),
  // Comma-separated list of origins allowed to post feedback. Empty = any origin.
  allowedOrigins: text("allowed_origins").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CommentMeta = {
  userAgent?: string;
  viewport?: { w: number; h: number };
  scroll?: { x: number; y: number };
  devicePixelRatio?: number;
  elementText?: string;
};

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Per-project sequence shown as e.g. DEM-12.
    number: integer("number").notNull(),
    // Normalised page URL (origin + pathname) used to show pins on the right page.
    pageUrl: text("page_url").notNull(),
    fullUrl: text("full_url").notNull(),
    // CSS selector of the element the pin is attached to, plus offset within it (0..1).
    selector: text("selector").notNull(),
    offsetX: real("offset_x").notNull(),
    offsetY: real("offset_y").notNull(),
    // Fallback document position (px) when the selector no longer matches.
    pageX: real("page_x").notNull(),
    pageY: real("page_y").notNull(),
    body: text("body").notNull(),
    authorName: text("author_name").notNull(),
    status: text("status", { enum: ["open", "resolved"] }).notNull().default("open"),
    screenshot: text("screenshot"), // JPEG data URL (MVP: stored inline)
    meta: jsonb("meta").$type<CommentMeta>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_project_page_idx").on(t.projectId, t.pageUrl)],
);

export const replies = pgTable(
  "replies",
  {
    id: text("id").primaryKey(),
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    authorName: text("author_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("replies_comment_idx").on(t.commentId)],
);

// Mirror of Neon Auth users (same id). Credentials and sessions live in Neon Auth.
// Legacy password_hash / google_sub columns and the sessions table remain in the database but are unused.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(), // stored lower-cased
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Role = "owner" | "member";

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

export const invites = pgTable("invites", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
  invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Personal access tokens for the MCP server. Only the sha256 is stored; the token is shown once.
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    // First characters of the token ("fx_ab12…"), so people can tell tokens apart.
    hint: text("hint").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_tokens_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Reply = typeof replies.$inferSelect;
