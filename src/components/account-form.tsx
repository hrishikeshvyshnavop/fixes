"use client";

import { useActionState } from "react";
import { updateAccount, type AccountState } from "@/app/auth-actions";
import { button, input } from "./styles";

export function AccountForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateAccount, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-[13px] font-medium">Name</span>
        <input name="name" defaultValue={name} required maxLength={100} className={`${input} mt-1.5`} />
      </label>
      <label className="block">
        <span className="text-[13px] font-medium">Email</span>
        <input value={email} disabled className={`${input} mt-1.5 opacity-70`} />
        <span className="mt-1.5 block text-xs text-muted-foreground">Email can&apos;t be changed yet.</span>
      </label>
      <div className="flex items-center justify-end gap-3">
        {state?.error && <span className="text-[13px] text-destructive">{state.error}</span>}
        {state?.ok && <span className="text-[13px] text-emerald-500">✓ Saved</span>}
        <button disabled={pending} className={button.primary}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
