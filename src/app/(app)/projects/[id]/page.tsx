import Link from "next/link";
import { getAccess } from "@/lib/auth";
import { InviteButton } from "@/components/invite-dialog";
import { listComments, ownedProjects } from "@/lib/queries";
import { hue } from "@/lib/ui";
import { Swatch } from "@/components/sidebar-nav";
import { CodeIcon, ExternalLinkIcon, SlidersIcon } from "@/components/icons";
import {
  EmptyState,
  FeedbackGroups,
  PageFilter,
  PanelHeader,
  Toolbar,
  ViewTabs,
  button,
  parseFilter,
  statusGroups,
  type Filter,
} from "@/components/feedback";

export default async function ProjectFeedback({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const filter = parseFilter(sp.status);

  const { project, role, user } = await getAccess(id);
  const invitable = role === "owner" ? await ownedProjects(user.id) : [];

  const all = await listComments({ projectId: id, viewerId: user.id });
  const onPage = sp.page ? all.filter((c) => c.pageUrl === sp.page) : all;
  const pages = [...new Set(all.map((c) => c.pageUrl))].sort();
  const counts = {
    all: onPage.length,
    open: onPage.filter((c) => c.status === "open").length,
    resolved: onPage.filter((c) => c.status === "resolved").length,
  };

  const qs = (o: { status?: Filter; page?: string | null }) => {
    const p = new URLSearchParams();
    const status = o.status ?? filter;
    const page = o.page === null ? undefined : (o.page ?? sp.page);
    if (status !== "open") p.set("status", status);
    if (page) p.set("page", page);
    const s = p.toString();
    return `/projects/${id}${s ? `?${s}` : ""}`;
  };

  const isDemo = project.id === "demo";

  return (
    <>
      <PanelHeader
        right={
          <>
            {isDemo && (
              <a href="/demo.html" target="_blank" className={button.ghost}>
                <ExternalLinkIcon size={14} /> <span className="hidden lg:inline">Demo site</span>
              </a>
            )}
            {role === "owner" && <InviteButton projects={invitable} defaultProjectIds={[id]} />}
            <Link href={`/projects/${id}/settings`} className={button.ghost} title="Install & settings">
              <CodeIcon size={14} /> <span className="hidden lg:inline">Install</span>
            </Link>
          </>
        }
      >
        <span className="mr-1.5 hidden items-center gap-2 text-[13px] font-medium lg:flex">
          <Swatch name={project.name} hue={hue(project.id)} icon={project.icon} color={project.color} size={16} />
          {project.name}
        </span>
        <ViewTabs current={filter} counts={counts} href={(f) => qs({ status: f })} />
      </PanelHeader>

      <Toolbar
        right={
          <Link href={`/projects/${id}/settings`} className={`${button.outline} h-7`}>
            <SlidersIcon size={14} /> Settings
          </Link>
        }
      >
        <PageFilter pages={pages} current={sp.page} href={(page) => qs({ page: page ?? null })} />
      </Toolbar>

      <FeedbackGroups
        groups={statusGroups(onPage, filter)}
        prefixes={{ [project.id]: project.prefix }}
        empty={
          all.length === 0 ? (
            <EmptyState title="No feedback yet">
              <Link href={`/projects/${id}/settings`} className="font-medium text-foreground underline underline-offset-4">
                Install the widget
              </Link>{" "}
              on your site, then click <span className="font-medium text-foreground">Feedback</span> on any page.
            </EmptyState>
          ) : (
            <EmptyState title={filter === "open" ? "Nothing open" : "Nothing here"}>
              {filter === "open" ? "Every comment in this view has been resolved." : "No feedback matches this view."}
            </EmptyState>
          )
        }
      />
    </>
  );
}
