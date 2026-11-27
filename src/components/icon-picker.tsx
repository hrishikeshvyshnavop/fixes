"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { COLORS, COLOR_RE, searchEmojis, searchIcons } from "@/lib/project-icons";
import { ProjectIcon } from "./project-icon";

export type IconValue = { icon: string; color: string };

/**
 * Bordered icon button that opens a popover to choose a project icon (Lucide or emoji) and color.
 * Writes hidden `icon` / `color` inputs so it works inside plain <form>s / server actions.
 */
export function IconPicker({
  value,
  onChange,
  name = "",
  size = 36,
}: {
  value: IconValue;
  onChange: (v: IconValue) => void;
  name?: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"icons" | "emojis">(value.icon.startsWith("emoji:") ? "emojis" : "icons");
  const [query, setQuery] = useState("");
  const [customOpen, setCustomOpen] = useState(!COLORS.includes(value.color));
  const [hex, setHex] = useState(value.color);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  // Fixed positioning anchored to the trigger, so scrollable ancestors (e.g. a modal body) can't clip it.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(452, window.innerWidth - 48);
      const left = Math.max(16, Math.min(r.left, window.innerWidth - width - 16));
      const top = r.bottom + 8;
      setPos({ top, left, maxHeight: window.innerHeight - top - 16 });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Close on outside click; Esc closes the popover without closing an enclosing modal.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);


  const icons = useMemo(() => searchIcons(query), [query]);
  const emojis = useMemo(() => searchEmojis(query), [query]);
  const isCustom = !COLORS.includes(value.color);

  const setColor = (color: string) => onChange({ ...value, color });
  const pick = (icon: string) => {
    onChange({ ...value, icon });
    close();
  };

  return (
    <div ref={root} className="relative inline-block">
      <input type="hidden" name="icon" value={value.icon} />
      <input type="hidden" name="color" value={value.color} />
      <button
        ref={trigger}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Choose project icon"
        title="Choose icon"
        className={`inline-flex items-center justify-center rounded-md border border-border bg-background shadow-xs transition-colors hover:bg-accent dark:bg-input/30 dark:hover:bg-input/50 ${
          open ? "ring-[3px] ring-ring/40" : ""
        }`}
        style={{ width: size, height: size }}
      >
        <ProjectIcon name={name || "?"} hue={0} icon={value.icon} color={value.color} size={Math.round(size * 0.5)} />
      </button>

      {open && pos && (
        <div
          role="dialog"
          aria-label="Project icon"
          style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
          className="fixed z-[60] flex w-[min(452px,calc(100vw-48px))] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
        >
          {/* Tabs */}
          <div role="tablist" className="flex gap-1 border-b border-border px-3">
            {(["icons", "emojis"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-2.5 py-2.5 text-[13px] font-medium capitalize transition-colors ${
                  tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Colors (icons only — emojis carry their own color) */}
          {tab === "icons" && (
            <div className="border-b border-border px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {COLORS.map((c) => {
                    const selected = value.color.toLowerCase() === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setColor(c);
                          setCustomOpen(false);
                        }}
                        aria-label={`Color ${c}`}
                        aria-pressed={selected}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
                        style={{ background: c }}
                      >
                        {selected && <Check size={13} strokeWidth={3} className="text-white drop-shadow" />}
                      </button>
                    );
                  })}
                </div>
                <span className="h-6 w-px bg-border" />
                <button
                  type="button"
                  onClick={() => setCustomOpen(!customOpen)}
                  aria-label="Custom color"
                  aria-expanded={customOpen}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-[13px] font-semibold transition-colors ${
                    isCustom ? "border-transparent text-white" : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                  style={isCustom ? { background: value.color } : undefined}
                >
                  #
                </button>
              </div>
              {customOpen && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="color"
                    value={COLOR_RE.test(hex) ? hex : value.color}
                    onChange={(e) => {
                      setHex(e.target.value);
                      setColor(e.target.value);
                    }}
                    aria-label="Pick custom color"
                    className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <input
                    value={hex}
                    onChange={(e) => {
                      const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                      setHex(v.slice(0, 7));
                      if (COLOR_RE.test(v)) setColor(v.toLowerCase());
                    }}
                    spellCheck={false}
                    aria-label="Hex color"
                    placeholder="#5e6ad2"
                    className="h-8 w-28 rounded-md border border-input bg-transparent px-2 font-mono text-[13px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                  {!COLOR_RE.test(hex) && <span className="text-xs text-muted-foreground">Use #rrggbb</span>}
                </div>
              )}
            </div>
          )}

          {/* Search */}
          <div className="px-3 pt-3">
            <label className="flex h-9 items-center gap-2 rounded-md bg-muted px-2.5 text-muted-foreground focus-within:ring-[3px] focus-within:ring-ring/40">
              <Search size={15} />
              <input
                ref={search}
                key={tab}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tab === "icons" ? "Search icons" : "Search emojis"}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>

          {/* Grid */}
          <div className="h-[268px] min-h-[120px] shrink overflow-y-auto px-3 pt-2 pb-3">
            {tab === "icons" ? (
              icons.length ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-0.5">
                  {icons.map(({ id, Icon }) => {
                    const selected = value.icon === `lucide:${id}`;
                    return (
                      <button
                        key={id}
                        type="button"
                        title={id}
                        aria-label={id}
                        aria-pressed={selected}
                        onClick={() => pick(`lucide:${id}`)}
                        className={`flex aspect-square items-center justify-center rounded-md transition-colors hover:bg-accent ${
                          selected ? "bg-accent ring-1 ring-border" : ""
                        }`}
                      >
                        <Icon size={17} strokeWidth={2} style={{ color: value.color }} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Empty q={query} />
              )
            ) : emojis.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-0.5">
                {emojis.map(([e, label]) => {
                  const selected = value.icon === `emoji:${e}`;
                  return (
                    <button
                      key={e}
                      type="button"
                      title={label.split(" ")[0]}
                      aria-label={label.split(" ")[0]}
                      aria-pressed={selected}
                      onClick={() => pick(`emoji:${e}`)}
                      className={`flex aspect-square items-center justify-center rounded-md text-lg transition-colors hover:bg-accent ${
                        selected ? "bg-accent ring-1 ring-border" : ""
                      }`}
                    >
                      {e}
                    </button>
                  );
                })}
              </div>
            ) : (
              <Empty q={query} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ q }: { q: string }) {
  return <p className="py-10 text-center text-[13px] text-muted-foreground">Nothing matches “{q}”</p>;
}
