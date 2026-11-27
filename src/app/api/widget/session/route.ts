import { claimSession, endSession } from "@/lib/widget-auth";
import { ApiError, handle, json, preflight, projectForKey, str } from "@/lib/widget-api";

export const OPTIONS = preflight;

// POST /api/widget/session  { key, nonce }
// Polled by the widget while the Google sign-in popup is open. Returns { token: null } until the
// popup has finished, then { token, user } exactly once.
export function POST(req: Request) {
  return handle(req, async () => {
    const b = await req.json().catch(() => {
      throw new ApiError(400, "Invalid JSON");
    });
    const project = await projectForKey(req, b.key);
    const claimed = await claimSession(req, project, str(b.nonce, "nonce", 200));
    return json(req, claimed ?? { token: null });
  });
}

// DELETE /api/widget/session  (Authorization: Bearer <widget token>) — sign the widget out.
export function DELETE(req: Request) {
  return handle(req, async () => {
    await endSession(req);
    return json(req, { ok: true });
  });
}
