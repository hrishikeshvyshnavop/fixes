import "server-only";
import { headers } from "next/headers";

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i;

/**
 * Public base URL of this Fixes deployment, used in install snippets.
 * APP_URL wins (set it in production); otherwise it's derived from the current request.
 * `reachable` is false when the address only works on this machine / local network.
 */
export async function getAppUrl(): Promise<{ url: string; fromEnv: boolean; reachable: boolean }> {
  const env = process.env.APP_URL?.trim().replace(/\/+$/, "");
  let url = env;
  if (!url) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    url = `${h.get("x-forwarded-proto") ?? (LOCAL_HOST.test(host) ? "http" : "https")}://${host}`;
  }
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    /* keep empty → not reachable */
  }
  return { url, fromEnv: !!env, reachable: !!host && !LOCAL_HOST.test(host) };
}
