// Presentation helpers shared by dashboard pages.

/** "Demo site" → "DEM". Used for short ids like DEM-12. */
export function projectPrefix(name: string): string {
  const letters = name.replace(/[^a-z]/gi, "").toUpperCase();
  return letters.slice(0, 3) || "FB";
}

/** Stable hue per string for project swatches. */
export function hue(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function shortDate(d: Date): string {
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function ago(d: Date): string {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return shortDate(d);
}

export function expiresIn(d: Date): string {
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.ceil(ms / 3600_000);
  return h < 24 ? `expires in ${h}h` : `expires in ${Math.ceil(h / 24)}d`;
}

export function browser(ua?: string): string {
  if (!ua) return "Unknown";
  const b = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return [b, os].filter(Boolean).join(" · ");
}

export function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
