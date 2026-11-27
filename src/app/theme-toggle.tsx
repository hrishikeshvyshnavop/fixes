"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/icons";

type Theme = "dark" | "light" | "system";
const ORDER: Theme[] = ["dark", "light", "system"];
const KEY = "theme";
const DEFAULT: Theme = "dark";

/** Runs before paint (inlined in <head>) so there's no flash of the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${KEY}")||"${DEFAULT}";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){document.documentElement.classList.add("dark")}})()`;

function apply(theme: Theme) {
  const dark =
    theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" || t === "system" ? t : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

const ICON = { dark: MoonIcon, light: SunIcon, system: MonitorIcon };

// Every toggle on the page shares the stored value; this event tells them it changed.
const THEME_EVENT = "fixes:theme";
function subscribe(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function ThemeToggle() {
  // null on the server / first paint, so the label doesn't mismatch during hydration.
  const theme = useSyncExternalStore<Theme | null>(subscribe, read, () => null);
  const setTheme = (t: Theme) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* storage blocked */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  // Track OS changes while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const current = theme ?? DEFAULT;
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const label = current[0].toUpperCase() + current.slice(1);
  const Icon = ICON[current];

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        apply(next);
      }}
      title={`Theme: ${label} (click for ${next})`}
      aria-label={`Theme: ${label}. Switch to ${next}`}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-sidebar-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Icon size={13} />
      <span className={theme ? "" : "invisible"}>{label}</span>
    </button>
  );
}
