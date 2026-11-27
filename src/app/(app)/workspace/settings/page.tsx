import { Settings } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageShell } from "@/components/page-shell";
import { AccountForm } from "@/components/account-form";

export default async function WorkspaceSettings() {
  const user = await requireUser();
  return (
    <PageShell icon={<Settings size={15} />} section="Workspace" title="Settings">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your account and preferences. Project settings live on each project.</p>
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Account</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Your name is shown on replies and in member lists.</p>
        </div>
        <div className="px-5 py-4">
          <AccountForm name={user.name} email={user.email} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Sign-in methods</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">How people can log in to this Fixes server.</p>
        </div>
        <ul className="divide-y divide-border text-[13px]">
          <li className="flex items-center justify-between gap-4 px-5 py-3">
            <span>Email + password</span>
            <span className="text-emerald-500">On</span>
          </li>
          <li className="flex items-center justify-between gap-4 px-5 py-3">
            <span>Google</span>
            <span className="text-emerald-500">On</span>
          </li>
          <li className="flex items-center justify-between gap-4 px-5 py-3">
            <span>SAML SSO · Passkeys</span>
            <span className="text-muted-foreground">Not available yet</span>
          </li>
        </ul>
        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Sign-in is handled by Neon Auth. Manage providers, email settings and trusted domains in the Neon Console → Auth.
        </div>
      </section>

      <p className="text-[13px] text-muted-foreground">Theme and sign out are at the bottom of the sidebar.</p>
    </PageShell>
  );
}
