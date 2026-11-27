"use server";

import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getAccess, newToken, requireOwner, requireUser, sha256 } from "@/lib/auth";
import { projectPrefix } from "@/lib/ui";
import { COLOR_RE, ICON_RE } from "@/lib/project-icons";
import { isProjectType } from "@/lib/project-types";
import { parseOrigins } from "@/lib/origins";
import { getAppUrl } from "@/lib/app-url";

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREFIX_RE = /^[A-Z][A-Z0-9]{0,4}$/;
const INVITE_DAYS = 7;

// Sidebar counts appear on every page, so refresh the whole tree after a mutation.
const refresh = () => revalidatePath("/", "layout");

export type ActionState = { ok?: string; error?: string; link?: string } | undefined;

// ---------- projects ----------

/** Shared validation for the name / identifier / appearance / brief fields. */
function projectFields(fd: FormData): { error: string } | { values: {
  name: string; prefix: string; type: string; icon: string | null; color: string | null; summary: string; description: string; allowedOrigins: string;
} } {
  const name = field(fd, "name");
  if (!name) return { error: "Give the project a name." };
  const prefix = (field(fd, "prefix") || projectPrefix(name)).toUpperCase();
  if (!PREFIX_RE.test(prefix)) return { error: "Identifier must be 1–5 letters or digits, starting with a letter." };
  const icon = field(fd, "icon");
  const color = field(fd, "color").toLowerCase();
  if (icon && !ICON_RE.test(icon)) return { error: "Invalid icon." };
  if (color && !COLOR_RE.test(color)) return { error: "Color must be a hex value like #5e6ad2." };
  const type = field(fd, "type") || "website";
  if (!isProjectType(type)) return { error: "Unknown project type." };
  return {
    values: {
      name: name.slice(0, 100),
      prefix,
      type,
      icon: icon || null,
      color: color || null,
      summary: field(fd, "summary").slice(0, 255),
      description: String(fd.get("description") ?? "").trim().slice(0, 10000),
      allowedOrigins: parseOrigins(field(fd, "allowedOrigins")).join(", "),
    },
  };
}

export async function createProject(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = projectFields(fd);
  if ("error" in parsed) return { error: parsed.error };
  const db = await getDb();
  const id = nanoid(10);
  await db.insert(schema.projects).values({ id, publicKey: `pk_${nanoid(16)}`, ...parsed.values });
  await db.insert(schema.projectMembers).values({ projectId: id, userId: user.id, role: "owner" });
  refresh();
  redirect(`/projects/${id}/settings`);
}

export async function updateProject(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = field(fd, "projectId");
  try {
    await requireOwner(id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = projectFields(fd);
  if ("error" in parsed) return { error: parsed.error };

  const db = await getDb();
  await db.update(schema.projects).set(parsed.values).where(eq(schema.projects.id, id));
  refresh();
  return { ok: "Saved" };
}

export async function deleteProject(fd: FormData) {
  const id = field(fd, "projectId");
  await requireOwner(id);
  const db = await getDb();
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
  refresh();
  redirect("/projects");
}

// ---------- feedback ----------

export async function setStatus(fd: FormData) {
  const projectId = field(fd, "projectId");
  await getAccess(projectId);
  const status = field(fd, "status") === "resolved" ? "resolved" : "open";
  const db = await getDb();
  await db
    .update(schema.comments)
    .set({ status })
    .where(and(eq(schema.comments.id, field(fd, "commentId")), eq(schema.comments.projectId, projectId)));
  refresh();
}

export async function addReply(fd: FormData) {
  const projectId = field(fd, "projectId");
  const { user } = await getAccess(projectId);
  const commentId = field(fd, "commentId");
  const body = field(fd, "body");
  if (!body) return;
  const db = await getDb();
  const [parent] = await db
    .select({ id: schema.comments.id })
    .from(schema.comments)
    .where(and(eq(schema.comments.id, commentId), eq(schema.comments.projectId, projectId)));
  if (!parent) return;
  await db.insert(schema.replies).values({ id: nanoid(12), commentId, body: body.slice(0, 5000), authorName: user.name });
  refresh();
}

export async function deleteComment(fd: FormData) {
  const projectId = field(fd, "projectId");
  await getAccess(projectId);
  const db = await getDb();
  await db
    .delete(schema.comments)
    .where(and(eq(schema.comments.id, field(fd, "commentId")), eq(schema.comments.projectId, projectId)));
  refresh();
  redirect(`/projects/${projectId}`);
}

// ---------- members & invites ----------

/** Create (or replace) one pending invite. Caller must already have checked ownership. */
async function issueInvite(opts: {
  projectId: string;
  email: string;
  role: "owner" | "member";
  invitedBy: string;
  origin: string;
}): Promise<{ link: string } | { error: string }> {
  const db = await getDb();
  const [member] = await db
    .select({ id: schema.users.id })
    .from(schema.projectMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.projectMembers.userId))
    .where(and(eq(schema.projectMembers.projectId, opts.projectId), eq(schema.users.email, opts.email)));
  if (member) return { error: "Already a member" };

  // One live invite per email per project: replace any pending one (its old link stops working).
  await db
    .delete(schema.invites)
    .where(and(eq(schema.invites.projectId, opts.projectId), eq(schema.invites.email, opts.email), isNull(schema.invites.acceptedAt)));

  const token = newToken();
  await db.insert(schema.invites).values({
    id: nanoid(12),
    tokenHash: sha256(token),
    projectId: opts.projectId,
    email: opts.email,
    role: opts.role,
    invitedBy: opts.invitedBy,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86400_000),
  });
  return { link: `${opts.origin}/invite/${token}` };
}

export async function createInvite(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const projectId = field(fd, "projectId");
  let user;
  try {
    ({ user } = await requireOwner(projectId));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const email = field(fd, "email").toLowerCase();
  const role = field(fd, "role") === "owner" ? "owner" : "member";
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const res = await issueInvite({ projectId, email, role, invitedBy: user.id, origin: (await getAppUrl()).url });
  if ("error" in res) return { error: `${email} is already a member.` };
  revalidatePath(`/projects/${projectId}/settings`);
  return { ok: `Invite created for ${email}`, link: res.link };
}

export type InviteResult = { email: string; projectId: string; projectName: string; link?: string; error?: string };
export type InviteBatchState = { results?: InviteResult[]; error?: string } | undefined;

const MAX_EMAILS = 25;
const MAX_PROJECTS = 10;

/** Invite several people to several projects in one go (every email × every project). */
export async function createInvites(_prev: InviteBatchState, fd: FormData): Promise<InviteBatchState> {
  const user = await requireUser();
  const emails = [
    ...new Set(
      fd
        .getAll("email")
        .flatMap((v) => String(v).split(/[\s,;]+/))
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const projectIds = [...new Set(fd.getAll("projectId").map(String).filter(Boolean))];
  const role = field(fd, "role") === "owner" ? "owner" : "member";

  if (!emails.length) return { error: "Add at least one email address." };
  if (emails.length > MAX_EMAILS) return { error: `You can invite up to ${MAX_EMAILS} people at a time.` };
  const bad = emails.filter((e) => !EMAIL_RE.test(e));
  if (bad.length) return { error: `Not a valid email: ${bad.join(", ")}` };
  if (!projectIds.length) return { error: "Choose at least one project." };
  if (projectIds.length > MAX_PROJECTS) return { error: `Choose up to ${MAX_PROJECTS} projects at a time.` };

  // Only projects the caller owns; anything else is reported rather than silently skipped.
  const db = await getDb();
  const owned = await db
    .select({ id: schema.projects.id, name: schema.projects.name })
    .from(schema.projectMembers)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.projectMembers.projectId))
    .where(and(eq(schema.projectMembers.userId, user.id), eq(schema.projectMembers.role, "owner")));
  const ownedById = new Map(owned.map((p) => [p.id, p.name]));

  const origin = (await getAppUrl()).url;
  const results: InviteResult[] = [];
  for (const projectId of projectIds) {
    const projectName = ownedById.get(projectId);
    for (const email of emails) {
      if (!projectName) {
        results.push({ email, projectId, projectName: "Unknown project", error: "You're not an owner of this project" });
        continue;
      }
      if (email === user.email) {
        results.push({ email, projectId, projectName, error: "That's you" });
        continue;
      }
      const res = await issueInvite({ projectId, email, role, invitedBy: user.id, origin });
      results.push({ email, projectId, projectName, ...res });
    }
    if (projectName) revalidatePath(`/projects/${projectId}/settings`);
  }
  return { results };
}

export async function revokeInvite(fd: FormData) {
  const projectId = field(fd, "projectId");
  await requireOwner(projectId);
  const db = await getDb();
  await db
    .delete(schema.invites)
    .where(and(eq(schema.invites.id, field(fd, "inviteId")), eq(schema.invites.projectId, projectId)));
  revalidatePath(`/projects/${projectId}/settings`);
}

async function ownerCount(projectId: string) {
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.role, "owner")));
  return n;
}

/** Owners can remove anyone; anyone can remove themselves (leave). The last owner can't leave. */
export async function removeMember(fd: FormData) {
  const projectId = field(fd, "projectId");
  const userId = field(fd, "userId");
  const { user, role } = await getAccess(projectId);
  const self = userId === user.id;
  if (!self && role !== "owner") throw new Error("Only project owners can remove members");

  const db = await getDb();
  const [target] = await db
    .select({ role: schema.projectMembers.role })
    .from(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, userId)));
  if (!target) return;
  if (target.role === "owner" && (await ownerCount(projectId)) <= 1)
    throw new Error("A project needs at least one owner. Make someone else owner first.");

  await db
    .delete(schema.projectMembers)
    .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, userId)));
  refresh();
  if (self) redirect("/projects");
}

export async function setMemberRole(fd: FormData) {
  const projectId = field(fd, "projectId");
  const userId = field(fd, "userId");
  const role = field(fd, "role") === "owner" ? "owner" : "member";
  await requireOwner(projectId);
  const db = await getDb();
  if (role === "member") {
    const others = await db
      .select({ id: schema.projectMembers.userId })
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.role, "owner"),
          ne(schema.projectMembers.userId, userId),
        ),
      );
    if (!others.length) throw new Error("A project needs at least one owner.");
  }
  await db
    .update(schema.projectMembers)
    .set({ role })
    .where(and(eq(schema.projectMembers.projectId, projectId), eq(schema.projectMembers.userId, userId)));
  refresh();
}
