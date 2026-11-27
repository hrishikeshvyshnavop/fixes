"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { getUser, safeNext, sha256, syncUser } from "@/lib/auth";
import { auth } from "@/lib/neon-auth";

export type FormState = { error?: string; notice?: string; fields?: Record<string, string> } | undefined;

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthError = { code?: string; message?: string; status?: number } | null | undefined;
function authMessage(error: AuthError, fallback: string): string {
  switch (error?.code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with that email already exists. Log in instead.";
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_PASSWORD":
    case "USER_NOT_FOUND":
      return "Incorrect email or password.";
    case "EMAIL_NOT_VERIFIED":
      return "Verify your email address first. Check your inbox for the link or code.";
    case "PASSWORD_TOO_SHORT":
      return "Password must be at least 8 characters.";
    default:
      if (error) console.error("[auth]", error.code, error.message);
      return fallback;
  }
}

export async function signup(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = field(fd, "name");
  const email = field(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const fields = { name, email };

  if (!name) return { error: "Enter your name.", fields };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address.", fields };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", fields };

  const { data, error } = await auth.signUp.email({ email, password, name: name.slice(0, 100) });
  if (error || !data?.user) return { error: authMessage(error, "Couldn't create your account. Please try again."), fields };
  // No session token means the branch requires email verification before sign-in.
  if (!data.token) return { notice: "Check your email to verify your address, then log in.", fields };

  try {
    await syncUser(data.user);
  } catch (e) {
    return { error: (e as Error).message, fields };
  }
  redirect(safeNext(fd.get("next")));
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = field(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const { data, error } = await auth.signIn.email({ email, password });
  if (error || !data?.user) return { error: authMessage(error, "Couldn't log you in. Please try again."), fields: { email } };
  try {
    await syncUser(data.user);
  } catch (e) {
    return { error: (e as Error).message, fields: { email } };
  }
  redirect(safeNext(fd.get("next")));
}

export type AccountState = { error?: string; ok?: boolean } | undefined;

export async function updateAccount(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const user = await getUser();
  if (!user) redirect("/login");
  const name = field(fd, "name").slice(0, 100);
  if (!name) return { error: "Name can't be empty." };
  const { error } = await auth.updateUser({ name });
  if (error) return { error: authMessage(error, "Couldn't save your name. Please try again.") };
  const db = await getDb();
  await db.update(schema.users).set({ name }).where(eq(schema.users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logout() {
  await auth.signOut();
  redirect("/login");
}

export async function acceptInvite(fd: FormData) {
  const token = field(fd, "token");
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const db = await getDb();
  const [invite] = await db
    .select()
    .from(schema.invites)
    .where(
      and(eq(schema.invites.tokenHash, sha256(token)), isNull(schema.invites.acceptedAt), gt(schema.invites.expiresAt, new Date())),
    );
  // The invite page explains each failure case; here we just bounce back to it.
  if (!invite || invite.email !== user.email) redirect(`/invite/${token}`);

  await db
    .insert(schema.projectMembers)
    .values({ projectId: invite.projectId, userId: user.id, role: invite.role })
    .onConflictDoNothing();
  await db.update(schema.invites).set({ acceptedAt: new Date() }).where(eq(schema.invites.id, invite.id));
  redirect(`/projects/${invite.projectId}`);
}
