import { requireWidgetUser } from "@/lib/widget-auth";
import { projectMembersForWidget } from "@/lib/widget-data";
import { handle, json, preflight, projectForKey } from "@/lib/widget-api";

export const OPTIONS = preflight;

// GET /api/widget/members?key=pk_xxx  — people who can be @mentioned (signed-in members only)
export function GET(req: Request) {
  return handle(req, async () => {
    const project = await projectForKey(req, new URL(req.url).searchParams.get("key"));
    await requireWidgetUser(req, project);
    return json(req, { members: await projectMembersForWidget(project.id) });
  });
}
