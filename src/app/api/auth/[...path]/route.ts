import { auth } from "@/lib/neon-auth";

// Same-origin proxy to Neon Auth (used by the browser client, e.g. Google sign-in).
export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
