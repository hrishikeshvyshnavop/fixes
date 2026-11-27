"use server";

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getUser } from "@/lib/auth";
import { originAllowed, parseOrigins } from "@/lib/origins";
import { createPendingSession, ensureCommenter, hasGoogleAccount } from "@/lib/widget-auth";

export type WidgetSignInResult = { ok: true; name: string } | { ok: false; error: string };

/**
 * Called by the sign-in popup once the person is signed in. Re-checks everything the page
 * showed (Google account, invite/membership, allowed origin) and records the hand-off.
 */
export async function completeWidgetSignIn(key: string, origin: string, nonce: string): Promise<WidgetSignInResult> {
  if (!key || !origin || !nonce || nonce.length < 20 || nonce.length > 200) return { ok: false, error: "Invalid sign-in link." };
  const db = await getDb();
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.publicKey, key)).limit(1);
  if (!project) return { ok: false, error: "Unknown project." };
  if (!originAllowed(origin, parseOrigins(project.allowedOrigins))) return { ok: false, error: `${origin} isn't allowed for this project.` };

  const user = await getUser().catch(() => null);
  if (!user) return { ok: false, error: "You're not signed in." };
  if (!(await hasGoogleAccount())) return { ok: false, error: "Sign in with Google to comment." };
  if (!(await ensureCommenter(user, project.id)))
    return { ok: false, error: `${user.email} hasn't been invited to ${project.name}.` };

  await createPendingSession({ user, project, origin, nonce });
  return { ok: true, name: user.name };
}
