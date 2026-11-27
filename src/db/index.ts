import "server-only";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

// Idempotent bootstrap. Keeps the MVP free of a migration step; swap for
// drizzle-kit migrations once the schema starts changing in production.
const BOOTSTRAP = `
CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  name text NOT NULL,
  public_key text NOT NULL UNIQUE,
  allowed_origins text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS comments (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_url text NOT NULL,
  full_url text NOT NULL,
  selector text NOT NULL,
  offset_x real NOT NULL,
  offset_y real NOT NULL,
  page_x real NOT NULL,
  page_y real NOT NULL,
  body text NOT NULL,
  author_name text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  screenshot text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_project_page_idx ON comments(project_id, page_url);
CREATE TABLE IF NOT EXISTS replies (
  id text PRIMARY KEY,
  comment_id text NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS replies_comment_idx ON replies(comment_id);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS number integer;
UPDATE comments c SET number = s.rn
  FROM (SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY created_at) AS rn FROM comments) s
  WHERE c.id = s.id AND c.number IS NULL;
ALTER TABLE comments ALTER COLUMN number SET NOT NULL;

-- Stable short identifier (DEM in DEM-12), decoupled from the editable name.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS prefix text;
INSERT INTO projects (id, name, public_key, prefix) VALUES ('demo', 'Demo site', 'pk_demo', 'DEM')
  ON CONFLICT (id) DO NOTHING;
UPDATE projects
  SET prefix = coalesce(nullif(upper(left(regexp_replace(name, '[^a-zA-Z]', '', 'g'), 3)), ''), 'FB')
  WHERE prefix IS NULL;
ALTER TABLE projects ALTER COLUMN prefix SET NOT NULL;

-- Project appearance and brief.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'website';

-- Install health: last time the widget checked in, and the last origin it was refused on.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS widget_seen_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS widget_seen_url text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS widget_blocked_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS widget_blocked_origin text;

-- Accounts, sessions, project membership, invites.
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY, -- sha256 of the cookie token; the raw token is never stored
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS project_members (
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_members_user_idx ON project_members(user_id);
CREATE TABLE IF NOT EXISTS invites (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE, -- sha256 of the link token
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  invited_by text REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invites_project_idx ON invites(project_id);

-- Google sign-in: accounts may have no password, and are linked by Google's stable user id.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx ON users(google_sub) WHERE google_sub IS NOT NULL;

-- MCP server personal access tokens (sha256 only).
CREATE TABLE IF NOT EXISTS api_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  hint text NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_tokens_user_idx ON api_tokens(user_id);

-- Widget sign-in (Google, invited project members only).
ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_id text;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS author_id text;
CREATE TABLE IF NOT EXISTS widget_sessions (
  id text PRIMARY KEY,
  nonce_hash text UNIQUE, -- sha256 of the one-time nonce, cleared once claimed
  token_hash text UNIQUE, -- sha256 of the bearer token, set when claimed
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  origin text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS widget_sessions_user_idx ON widget_sessions(user_id);
`;

type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

async function create(): Promise<DB> {
  if (process.env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(BOOTSTRAP);
    return drizzle(pool, { schema }) as unknown as DB;
  }
  // Local dev: embedded Postgres (WASM), persisted to ./.pglite
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(process.env.PGLITE_DIR ?? "./.pglite");
  await client.exec(BOOTSTRAP);
  return drizzle(client, { schema }) as unknown as DB;
}

// Survive Next.js dev hot reloads (one PGlite instance per process).
const g = globalThis as unknown as { __db?: Promise<DB> };

export function getDb(): Promise<DB> {
  g.__db ??= create();
  return g.__db;
}

export { schema, sql };
