"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CircleUser, CreditCard, Gauge, Plug, UserPlus, Users } from "lucide-react";
import { InviteButton, type InvitableProject } from "./invite-dialog";
import { PROJECT_TYPES, TYPE_META, type ProjectType } from "@/lib/project-types";
import { useState } from "react";
import { ProjectIcon } from "./project-icon";
import {
  BoxIcon,
  ChevronDownIcon,
  CodeIcon,
  InboxIcon,
  LayersIcon,
  PenSquareIcon,
  SlidersIcon,
} from "./icons";

export type SidebarProject = { id: string; name: string; open: number; hue: number; icon: string | null; color: string | null };

function Item({
  href,
  icon,
  children,
  count,
  indent = false,
  external = false,
  exact = false,
  active: activeOverride,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  count?: number;
  indent?: boolean;
  external?: boolean;
  exact?: boolean;
  /** Override route matching (e.g. for query-string filters). */
  active?: boolean;
}) {
  const path = usePathname();
  const active =
    activeOverride ?? (!external && (exact ? path === href : path === href || path.startsWith(href + "/")));
  const cls = `group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors ${
    indent ? "pl-7" : ""
  } ${
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
  }`;
  const inner = (
    <>
      <span className={active ? "text-sidebar-accent-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {!!count && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls} aria-current={active ? "page" : undefined}>
      {inner}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-6 items-center gap-1 rounded px-2 text-xs font-medium text-muted-foreground hover:text-sidebar-foreground"
      >
        {title}
        <ChevronDownIcon size={12} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="mt-0.5 space-y-px">{children}</div>}
    </div>
  );
}

export function Swatch(props: { name: string; hue: number; icon?: string | null; color?: string | null; size?: number }) {
  return <ProjectIcon {...props} />;
}

export function SidebarNav({
  projects,
  totalOpen,
  typeCounts,
  invitable,
}: {
  projects: SidebarProject[];
  totalOpen: number;
  typeCounts: Record<ProjectType, number>;
  invitable: InvitableProject[];
}) {
  const path = usePathname();
  const currentProject = path.match(/^\/projects\/([^/]+)/)?.[1];
  const typeParam = useSearchParams().get("type");
  const onProjects = path === "/projects";
  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-4">
      <div className="space-y-px">
        <Item href="/" exact icon={<InboxIcon />} count={totalOpen}>
          Inbox
        </Item>
        <Item href="/projects" icon={<BoxIcon />} active={onProjects && !typeParam}>
          All projects
        </Item>
      </div>

      <Section title="Project types">
        {PROJECT_TYPES.map((t) => {
          const { Icon, label } = TYPE_META[t];
          return (
            <Item key={t} href={`/projects?type=${t}`} icon={<Icon size={16} strokeWidth={1.75} />} count={typeCounts[t]} active={onProjects && typeParam === t}>
              {label}
            </Item>
          );
        })}
      </Section>

      <Section title="Your projects">
        {projects.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No projects yet</p>}
        {projects.map((p) => {
          const base = `/projects/${p.id}`;
          const expanded = path === base || path.startsWith(base + "/");
          return (
            <div key={p.id}>
              <Link
                href={base}
                className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-sidebar-foreground/90 hover:bg-sidebar-accent/60"
              >
                <Swatch name={p.name} hue={p.hue} icon={p.icon} color={p.color} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {!expanded && !!p.open && <span className="text-xs text-muted-foreground tabular-nums">{p.open}</span>}
                <ChevronDownIcon size={12} className={`text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`} />
              </Link>
              {expanded && (
                <div className="mt-px space-y-px">
                  <Item href={base} exact indent icon={<LayersIcon />} count={p.open}>
                    Feedback
                  </Item>
                  <Item href={`${base}/settings`} indent icon={<SlidersIcon />}>
                    Settings
                  </Item>
                </div>
              )}
            </div>
          );
        })}
      </Section>

      <Section title="Fixes AI">
        <Item href="/ai/usage" icon={<Gauge size={16} strokeWidth={1.75} />}>
          Usage
        </Item>
        <Item href="/ai/mcp" icon={<Plug size={16} strokeWidth={1.75} />}>
          MCP server
        </Item>
      </Section>

      <Section title="Workspace">
        <InviteButton
          projects={invitable}
          defaultProjectIds={currentProject ? [currentProject] : []}
          className="group flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <span className="text-muted-foreground group-hover:text-sidebar-accent-foreground">
            <UserPlus size={16} strokeWidth={1.75} />
          </span>
          <span className="flex-1 text-left">Invite people</span>
        </InviteButton>
        <Item href="/workspace/members" icon={<Users size={16} strokeWidth={1.75} />}>
          Members
        </Item>
        <Item href="/workspace/billing" icon={<CreditCard size={16} strokeWidth={1.75} />}>
          Billing
        </Item>
        <Item href="/workspace/settings" icon={<CircleUser size={16} strokeWidth={1.75} />}>
          Profile
        </Item>
      </Section>
    </nav>
  );
}

/**
 * Footer shortcut to the install snippet: the project you're in, else your first project,
 * else the new-project page (you need a project before there's anything to install).
 */
export function InstallWidgetLink({ projectIds }: { projectIds: string[] }) {
  const path = usePathname();
  const current = path.match(/^\/projects\/([^/]+)/)?.[1];
  const target = current && projectIds.includes(current) ? current : projectIds[0];
  const href = target ? `/projects/${target}/settings#install` : "/projects/new";
  const active = !!target && path === `/projects/${target}/settings`;
  return (
    <Link
      href={href}
      className={`flex h-8 items-center gap-2.5 rounded-md border px-2 text-[13px] font-medium transition-colors ${
        active
          ? "border-transparent bg-sidebar-accent text-sidebar-accent-foreground"
          : "border-sidebar-border text-sidebar-foreground/90 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      }`}
    >
      <CodeIcon className="text-muted-foreground" />
      <span className="flex-1">Install widget</span>
    </Link>
  );
}

export function NewProjectButton() {
  return (
    <Link
      href="/projects/new"
      title="New project"
      aria-label="New project"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sidebar-border bg-background text-sidebar-foreground shadow-xs hover:bg-sidebar-accent"
    >
      <PenSquareIcon size={14} />
    </Link>
  );
}
