// Allowed-origins parsing and matching, shared by the settings form and the widget API.
//
// Entries may be written as:
//   https://example.com   → that exact origin (scheme + host + port)
//   example.com           → that host on any scheme/port
//   *.example.com         → any subdomain of example.com (and example.com itself)

/** Clean one user-typed entry: lower-case, drop paths/trailing slashes, keep scheme if given. */
export function normalizeOriginEntry(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  if (s.includes("://")) {
    try {
      const u = new URL(s);
      return `${u.protocol}//${u.host}`;
    } catch {
      return s.replace(/\/+$/, "");
    }
  }
  return s.split("/")[0];
}

/** Parse the comma/space/newline-separated list stored on the project. */
export function parseOrigins(list: string): string[] {
  return [...new Set(list.split(/[\s,]+/).map(normalizeOriginEntry).filter(Boolean))];
}

/**
 * Local development addresses (any port): localhost, *.localhost, 127.x.x.x and [::1].
 * Always allowed, so developers can run a site on any local port without editing the list.
 * Only the developer's own machine can send these, and reading or posting comments still
 * requires a signed-in project member; the allow-list keeps guarding real domains.
 */
export function isLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h.endsWith(".localhost") || /^127(\.\d{1,3}){3}$/.test(h) || h === "[::1]";
  } catch {
    return false;
  }
}

export function originAllowed(origin: string, entries: string[]): boolean {
  if (!entries.length) return true;
  if (isLoopbackOrigin(origin)) return true;
  let host = "";
  let full = "";
  try {
    const u = new URL(origin);
    host = u.hostname.toLowerCase();
    full = `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return false;
  }
  return entries.some((e) => {
    if (e.includes("://")) return e === full;
    const bareHost = e.split(":")[0];
    if (bareHost.startsWith("*.")) {
      const base = bareHost.slice(2);
      return host === base || host.endsWith(`.${base}`);
    }
    return host === bareHost;
  });
}
