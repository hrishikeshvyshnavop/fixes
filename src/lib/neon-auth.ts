import "server-only";
import { createNeonAuth } from "@neon/auth/next/server";

// Neon Auth (Managed Better Auth). Users, passwords and sessions live in the `neon_auth`
// schema on the Neon branch; this app only mirrors id/email/name into its own `users` table.
const baseUrl = process.env.NEON_AUTH_BASE_URL;
const secret = process.env.NEON_AUTH_COOKIE_SECRET;
if (!baseUrl || !secret) {
  throw new Error(
    `Neon Auth is not configured: missing ${[!baseUrl && "NEON_AUTH_BASE_URL", !secret && "NEON_AUTH_COOKIE_SECRET"]
      .filter(Boolean)
      .join(" and ")}. Run \`npx neon neon-auth enable\` then \`npx neon env pull\`, and restart the dev server.`,
  );
}

export const auth = createNeonAuth({ baseUrl, cookies: { secret } });
