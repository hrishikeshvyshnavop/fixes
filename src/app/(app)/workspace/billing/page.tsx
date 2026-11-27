import { CreditCard } from "lucide-react";
import { NotYet, PageShell } from "@/components/page-shell";

export default function Billing() {
  return (
    <PageShell icon={<CreditCard size={15} />} section="Workspace" title="Billing">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">Plan, invoices and payment method.</p>
      </div>
      <section className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4">
        <div>
          <div className="text-[13px] text-muted-foreground">Current plan</div>
          <div className="mt-0.5 text-sm font-semibold">Free</div>
        </div>
        <span className="text-[13px] text-muted-foreground">No limits are enforced</span>
      </section>
      <NotYet title="Paid plans aren't set up">
        There&apos;s nothing to pay for and no payment details are collected. Plans, invoices and a payment method will appear
        here once billing exists.
      </NotYet>
    </PageShell>
  );
}
