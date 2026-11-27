import Link from "next/link";
import { setStatus } from "@/app/actions";
import type { CommentWithReplies } from "@/lib/queries";
import { initials, pathOf, shortDate } from "@/lib/ui";
import {
  AllStatusIcon,
  ChevronDownIcon,
  FilterIcon,
  ImageIcon,
  MessageIcon,
  OpenStatusIcon,
  ResolvedStatusIcon,
} from "./icons";

export const FILTERS = ["all", "open", "resolved"] as const;
export type Filter = (typeof FILTERS)[number];

export function parseFilter(v: string | undefined): Filter {
  return FILTERS.includes(v as Filter) ? (v as Filter) : "open";
}

// ---------- chrome ----------

export function PanelHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
      {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
    </header>
  );
}

export function Toolbar({ children, right }: { children?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {right}
    </div>
  );
}

export const chip =
  "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[13px] font-medium transition-colors";
export const chipIdle = "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground";
export const chipActive = "border-transparent bg-accent text-accent-foreground";

export function ViewTabs({
  current,
  href,
  counts,
}: {
  current: Filter;
  href: (f: Filter) => string;
  counts: Record<Filter, number>;
}) {
  const tabs: { f: Filter; label: string; icon: React.ReactNode }[] = [
    { f: "all", label: "All feedback", icon: <AllStatusIcon /> },
    { f: "open", label: "Open", icon: <OpenStatusIcon /> },
    { f: "resolved", label: "Resolved", icon: <ResolvedStatusIcon className="text-emerald-500" /> },
  ];
  return (
    <nav className="flex items-center gap-1.5 overflow-x-auto" aria-label="Views">
      {tabs.map((t) => (
        <Link
          key={t.f}
          href={href(t.f)}
          aria-current={current === t.f ? "page" : undefined}
          className={`${chip} ${current === t.f ? chipActive : chipIdle}`}
        >
          {t.icon}
          {t.label}
          <span className="text-xs text-muted-foreground tabular-nums">{counts[t.f]}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Native <details> dropdown, so it works without client JS. */
export function PageFilter({
  pages,
  current,
  href,
}: {
  pages: string[];
  current?: string;
  href: (page?: string) => string;
}) {
  return (
    <details className="group relative">
      <summary
        className={`flex h-7 cursor-pointer list-none items-center gap-1.5 rounded-md px-2 text-[13px] font-medium [&::-webkit-details-marker]:hidden ${
          current ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        <FilterIcon size={15} />
        {current ? <>Page: {pathOf(current)}</> : "Filter"}
        <ChevronDownIcon size={12} className="opacity-60" />
      </summary>
      <div className="absolute top-8 left-0 z-20 w-64 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Page</div>
        <Link href={href(undefined)} className={`block rounded-md px-2 py-1.5 text-[13px] hover:bg-accent ${!current ? "font-semibold" : ""}`}>
          All pages
        </Link>
        {pages.length === 0 && <div className="px-2 py-1.5 text-[13px] text-muted-foreground">No pages yet</div>}
        {pages.map((p) => (
          <Link
            key={p}
            href={href(p)}
            title={p}
            className={`block truncate rounded-md px-2 py-1.5 text-[13px] hover:bg-accent ${current === p ? "font-semibold" : ""}`}
          >
            {pathOf(p)}
          </Link>
        ))}
      </div>
    </details>
  );
}

// ---------- list ----------

export function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span
      title={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-1 ring-border"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initials(name)}
    </span>
  );
}

/** Clickable status glyph: toggles open ⇄ resolved via a server action. */
export function StatusToggle({ c, size = 14 }: { c: Pick<CommentWithReplies, "id" | "projectId" | "status">; size?: number }) {
  const resolved = c.status === "resolved";
  return (
    <form action={setStatus} className="relative z-10 flex">
      <input type="hidden" name="projectId" value={c.projectId} />
      <input type="hidden" name="commentId" value={c.id} />
      <input type="hidden" name="status" value={resolved ? "open" : "resolved"} />
      <button
        title={resolved ? "Reopen" : "Mark resolved"}
        aria-label={resolved ? "Reopen" : "Mark resolved"}
        className="group/status flex rounded-full p-0.5 text-muted-foreground hover:text-foreground"
      >
        {resolved ? (
          <ResolvedStatusIcon size={size} className="text-emerald-500" />
        ) : (
          <>
            <OpenStatusIcon size={size} className="group-hover/status:hidden" />
            <ResolvedStatusIcon size={size} className="hidden text-emerald-500/70 group-hover/status:block" />
          </>
        )}
      </button>
    </form>
  );
}

export type Group = {
  key: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  items: CommentWithReplies[];
  action?: React.ReactNode;
};

export function FeedbackGroups({
  groups,
  prefixes,
  showProject = false,
  projectNames = {},
  empty,
}: {
  groups: Group[];
  prefixes: Record<string, string>;
  showProject?: boolean;
  projectNames?: Record<string, string>;
  empty: React.ReactNode;
}) {
  const nonEmpty = groups.filter((g) => g.items.length);
  if (!nonEmpty.length) return <div className="flex flex-1 items-center justify-center p-10">{empty}</div>;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {nonEmpty.map((g) => (
        <section key={g.key}>
          <div className="sticky top-0 z-10 flex h-10 items-center gap-2.5 border-b border-border bg-muted/40 px-4 backdrop-blur">
            <ChevronDownIcon size={12} className="text-muted-foreground" />
            {g.icon}
            <span className="text-[13px] font-medium">{g.label}</span>
            <span className="text-[13px] text-muted-foreground tabular-nums">{g.items.length}</span>
            <span className="flex-1" />
            {g.action}
          </div>
          <ul>
            {g.items.map((c) => (
              <Row key={c.id} c={c} prefix={prefixes[c.projectId]} project={showProject ? projectNames[c.projectId] : undefined} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Row({ c, prefix, project }: { c: CommentWithReplies; prefix: string; project?: string }) {
  const href = `/projects/${c.projectId}/feedback/${c.id}`;
  return (
    <li className="group relative flex h-11 items-center gap-3 border-b border-border/60 px-4 text-[13px] hover:bg-accent/50">
      {/* Stretched link: the whole row navigates, while the status toggle stays clickable above it. */}
      <Link href={href} className="absolute inset-0" aria-label={`${prefix}-${c.number}: ${c.body.slice(0, 60)}`} />
      <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
        {prefix}-{c.number}
      </span>
      <StatusToggle c={c} />
      <span className={`min-w-0 flex-1 truncate font-medium ${c.status === "resolved" ? "text-muted-foreground" : ""}`}>
        {c.body}
      </span>
      <span className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
        {project && <span className="rounded-full border border-border px-2 py-0.5">{project}</span>}
        <span className="max-w-40 truncate rounded-full border border-border px-2 py-0.5 font-mono" title={c.fullUrl}>
          {pathOf(c.pageUrl)}
        </span>
        {c.replies.length > 0 && (
          <span className="inline-flex items-center gap-1" title={`${c.replies.length} replies`}>
            <MessageIcon size={13} />
            {c.replies.length}
          </span>
        )}
        {c.hasScreenshot && <ImageIcon size={13} aria-label="Has screenshot" />}
      </span>
      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">{shortDate(c.createdAt)}</span>
      <Avatar name={c.authorName} />
    </li>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-sm text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
        <OpenStatusIcon size={18} />
      </div>
      <h2 className="text-sm font-semibold">{title}</h2>
      {children && <div className="mt-1.5 text-[13px] text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Split comments into status groups for the "all" view, or a single group otherwise. */
export function statusGroups(items: CommentWithReplies[], filter: Filter): Group[] {
  const open = items.filter((c) => c.status === "open");
  const resolved = items.filter((c) => c.status === "resolved");
  const g: Group[] = [];
  if (filter !== "resolved") g.push({ key: "open", label: "Open", icon: <OpenStatusIcon className="text-muted-foreground" />, items: open });
  if (filter !== "open")
    g.push({ key: "resolved", label: "Resolved", icon: <ResolvedStatusIcon className="text-emerald-500" />, items: resolved });
  return g;
}

export { button, input } from "./styles";
