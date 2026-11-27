import { iconById } from "@/lib/project-icons";

/**
 * A project's icon: a Lucide glyph in the project color, an emoji, or (no icon set)
 * a colored letter badge. Usable from server and client components.
 */
export function ProjectIcon({
  name,
  hue,
  icon,
  color,
  size = 16,
  className = "",
}: {
  name: string;
  hue: number;
  icon?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  if (icon?.startsWith("emoji:")) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.85) }}
      >
        {icon.slice(6)}
      </span>
    );
  }
  const def = icon?.startsWith("lucide:") ? iconById(icon.slice(7)) : undefined;
  if (def) {
    const { Icon } = def;
    return (
      <Icon
        aria-hidden="true"
        className={`shrink-0 ${className}`}
        width={size}
        height={size}
        strokeWidth={size <= 18 ? 2 : 1.75}
        style={{ color: color ?? `oklch(0.7 0.14 ${hue})` }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[4px] font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.55)), background: color ?? `oklch(0.62 0.17 ${hue})` }}
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}
