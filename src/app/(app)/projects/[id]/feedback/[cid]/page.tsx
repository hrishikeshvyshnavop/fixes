import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addReply, deleteComment, setStatus } from "@/app/actions";
import { ago, browser, hue, pathOf, shortDate } from "@/lib/ui";
import { getAccess } from "@/lib/auth";
import { Swatch } from "@/components/sidebar-nav";
import { CheckIcon, ChevronRightIcon, ExternalLinkIcon, OpenStatusIcon, ResolvedStatusIcon, TrashIcon } from "@/components/icons";
import { Avatar, PanelHeader, button } from "@/components/feedback";

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-start gap-3 py-1.5 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function FeedbackDetail({ params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const { project } = await getAccess(id);
  const db = await getDb();
  const [c] = await db
    .select()
    .from(schema.comments)
    .where(and(eq(schema.comments.id, cid), eq(schema.comments.projectId, id)));
  if (!c) notFound();
  const replies = await db
    .select()
    .from(schema.replies)
    .where(eq(schema.replies.commentId, cid))
    .orderBy(asc(schema.replies.createdAt));

  const key = `${project.prefix}-${c.number}`;
  const resolved = c.status === "resolved";

  const statusForm = (
    <form action={setStatus}>
      <input type="hidden" name="projectId" value={id} />
      <input type="hidden" name="commentId" value={c.id} />
      <input type="hidden" name="status" value={resolved ? "open" : "resolved"} />
      <button className={resolved ? button.outline : button.primary}>
        {resolved ? (
          <>
            <OpenStatusIcon size={13} /> Reopen
          </>
        ) : (
          <>
            <CheckIcon size={14} /> Mark resolved
          </>
        )}
      </button>
    </form>
  );

  return (
    <>
      <PanelHeader
        right={
          <form action={deleteComment}>
            <input type="hidden" name="projectId" value={id} />
            <input type="hidden" name="commentId" value={c.id} />
            <button className={button.danger} title="Delete feedback">
              <TrashIcon size={14} /> <span className="hidden sm:inline">Delete</span>
            </button>
          </form>
        }
      >
        <Swatch name={project.name} hue={hue(project.id)} icon={project.icon} color={project.color} size={16} />
        <Link href={`/projects/${id}`} className="truncate text-[13px] text-muted-foreground hover:text-foreground">
          {project.name}
        </Link>
        <ChevronRightIcon size={13} className="shrink-0 text-muted-foreground" />
        <h1 className="font-mono text-[13px] font-medium">{key}</h1>
      </PanelHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Main column */}
        <div className="min-w-0 flex-1 lg:overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            <div className="flex items-start gap-3">
              <Avatar name={c.authorName} size={28} />
              <div className="min-w-0">
                <div className="text-[13px]">
                  <span className="font-medium">{c.authorName}</span>
                  <span className="ml-2 text-muted-foreground">{ago(c.createdAt)}</span>
                </div>
                <p className="mt-1 text-lg leading-snug font-medium break-words whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>

            {c.screenshot ? (
              <a
                href={`/api/admin/screenshots/${c.id}`}
                target="_blank"
                className="mt-6 block overflow-hidden rounded-lg border border-border bg-muted"
                title="Open full screenshot"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/admin/screenshots/${c.id}`} alt={`Screenshot for ${key}`} className="w-full" />
              </a>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
                No screenshot attached
              </div>
            )}

            <h2 className="mt-10 text-[13px] font-medium">Activity</h2>
            <ol className="mt-3 space-y-4 border-l border-border pl-5">
              <li className="relative text-[13px] text-muted-foreground">
                <span className="absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full bg-border" />
                <span className="font-medium text-foreground">{c.authorName}</span> pinned this on{" "}
                <span className="font-mono">{pathOf(c.pageUrl)}</span> · {ago(c.createdAt)}
              </li>
              {replies.map((r) => (
                <li key={r.id} className="relative">
                  <span className="absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full bg-muted-foreground/60" />
                  <div className="rounded-lg border border-border bg-card px-4 py-3">
                    <div className="flex items-center gap-2 text-[13px]">
                      <Avatar name={r.authorName} size={18} />
                      <span className="font-medium">{r.authorName}</span>
                      <span className="text-muted-foreground">{ago(r.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 text-sm break-words whitespace-pre-wrap">{r.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <form action={addReply} className="mt-6 rounded-lg border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
              <input type="hidden" name="projectId" value={id} />
              <input type="hidden" name="commentId" value={c.id} />
              <textarea
                name="body"
                required
                rows={3}
                placeholder="Leave a reply…"
                className="block w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              <div className="flex justify-end px-2 pb-2">
                <button className={`${button.primary} h-7`}>Reply</button>
              </div>
            </form>
          </div>
        </div>

        {/* Properties */}
        <aside className="shrink-0 border-t border-border px-5 py-5 lg:w-80 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <div className="mb-4">{statusForm}</div>
          <dl>
            <Prop label="Status">
              <span className="inline-flex items-center gap-1.5">
                {resolved ? <ResolvedStatusIcon className="text-emerald-500" /> : <OpenStatusIcon className="text-muted-foreground" />}
                {resolved ? "Resolved" : "Open"}
              </span>
            </Prop>
            <Prop label="Reporter">
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={c.authorName} size={18} />
                {c.authorName}
              </span>
            </Prop>
            <Prop label="Created">{shortDate(c.createdAt)}</Prop>
          </dl>
          <div className="my-4 border-t border-border" />
          <dl>
            <Prop label="Page">
              <a href={c.fullUrl} target="_blank" className="inline-flex items-center gap-1 font-mono text-xs hover:underline">
                {pathOf(c.fullUrl)} <ExternalLinkIcon size={11} className="text-muted-foreground" />
              </a>
            </Prop>
            {c.meta.elementText && (
              <Prop label="Element">
                <span className="line-clamp-2 text-muted-foreground">“{c.meta.elementText}”</span>
              </Prop>
            )}
            <Prop label="Selector">
              <code className="font-mono text-xs break-all text-muted-foreground">{c.selector}</code>
            </Prop>
          </dl>
          <div className="my-4 border-t border-border" />
          <dl>
            <Prop label="Browser">{browser(c.meta.userAgent)}</Prop>
            {c.meta.viewport && (
              <Prop label="Viewport">
                <span className="tabular-nums">
                  {c.meta.viewport.w} × {c.meta.viewport.h}
                  {c.meta.devicePixelRatio && c.meta.devicePixelRatio !== 1 ? ` @${c.meta.devicePixelRatio}x` : ""}
                </span>
              </Prop>
            )}
            {c.meta.scroll && (
              <Prop label="Scroll">
                <span className="tabular-nums">{Math.round(c.meta.scroll.y)}px</span>
              </Prop>
            )}
          </dl>
        </aside>
      </div>
    </>
  );
}
