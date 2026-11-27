import "server-only";

/**
 * Transactional email. Configure ONE of:
 *   RESEND_API_KEY=re_…                       (https://resend.com; verify your sending domain)
 *   SMTP_URL=smtps://user:pass@smtp.host:465  (any SMTP server, e.g. Gmail with an app password)
 * plus EMAIL_FROM="Fixes <invites@yourdomain.com>".
 * With neither set, sending is skipped and callers fall back to copyable links.
 */

export type Email = { to: string; subject: string; html: string; text: string; replyTo?: string };
export type SendResult = { sent: true } | { sent: false; reason: string };

export function emailProvider(): "resend" | "smtp" | null {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_URL) return "smtp";
  return null;
}

export const emailConfigured = () => emailProvider() !== null;

function from(): string {
  return process.env.EMAIL_FROM?.trim() || "Fixes <onboarding@resend.dev>";
}

export async function sendEmail(msg: Email): Promise<SendResult> {
  const provider = emailProvider();
  if (!provider) return { sent: false, reason: "Email isn't set up" };
  try {
    if (provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: from(),
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        console.error("[email] resend", res.status, body.message);
        return { sent: false, reason: body.message || `Email provider error (${res.status})` };
      }
      return { sent: true };
    }

    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(process.env.SMTP_URL!);
    await transport.sendMail({ from: from(), to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, replyTo: msg.replyTo });
    return { sent: true };
  } catch (e) {
    console.error("[email]", provider, e);
    return { sent: false, reason: "Couldn't send the email" };
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** One email per person, listing every project they were invited to with its own accept link. */
export function inviteEmail(opts: {
  inviter: string;
  role: "owner" | "member";
  invites: { projectName: string; link: string }[];
  days: number;
}): Pick<Email, "subject" | "html" | "text"> {
  const { inviter, role, invites, days } = opts;
  const what = invites.length === 1 ? invites[0].projectName : `${invites.length} projects`;
  const subject = `${inviter} invited you to ${what} on Fixes`;
  const roleText = role === "owner" ? "an owner" : "a member";

  const text = [
    `${inviter} invited you to join ${invites.length === 1 ? invites[0].projectName : "these projects"} on Fixes as ${roleText}.`,
    "",
    ...invites.map((i) => `${i.projectName}: ${i.link}`),
    "",
    `Each link works once and expires in ${days} days. Sign in or create an account with this email address to accept.`,
    "If you weren't expecting this, you can ignore this email.",
  ].join("\n");

  const rows = invites
    .map(
      (i) => `
      <tr><td style="padding:12px 0;border-top:1px solid #e4e4e7">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:14px;font-weight:600;color:#18181b">${esc(i.projectName)}</td>
          <td align="right"><a href="${esc(i.link)}" style="display:inline-block;background:#18181b;color:#fafafa;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:6px">Accept invite</a></td>
        </tr></table>
      </td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:28px">
      <tr><td>
        <div style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:14px 14px 14px 4px;background:#18181b;color:#fafafa;font-weight:700;font-size:13px">F</div>
        <h1 style="margin:18px 0 6px;font-size:18px;color:#18181b">You're invited to ${esc(what)}</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#52525b"><strong style="color:#18181b">${esc(inviter)}</strong> invited you to join as ${roleText}. Fixes is where your team collects and resolves website feedback.</p>
      </td></tr>
      ${rows}
      <tr><td style="padding-top:16px;border-top:1px solid #e4e4e7;font-size:12px;line-height:1.5;color:#71717a">
        Each link works once and expires in ${days} days. Sign in or create an account with this email address to accept.
        If you weren't expecting this, you can ignore this email.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  return { subject, html, text };
}
