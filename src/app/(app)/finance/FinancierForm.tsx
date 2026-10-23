"use client";

import { useActionState, useTransition } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import type { Financier } from "@/lib/financiers";
import { deleteFinancierAction, saveFinancierAction, toggleFinancier, type FinancierState } from "./actions";

export function FinancierForm({ id, defaults }: { id: number | null; defaults?: Partial<Financier> }) {
  const [state, run, pending] = useActionState<FinancierState, FormData>(saveFinancierAction.bind(null, id), {});
  return (
    <form action={run} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Finance company name" className="sm:col-span-2">
          <Input name="name" defaultValue={defaults?.name ?? ""} required placeholder="e.g. Bajaj Finance, HDFC, IDFC FIRST" />
        </Field>
        <Field label="Annual interest rate (%)" hint="Optional — used to estimate EMI">
          <Input name="interest_rate" type="number" step="0.01" min="0" max="50" defaultValue={defaults?.interest_rate ?? ""} placeholder="e.g. 18" />
        </Field>
        <Field label="Rate type">
          <Select name="rate_type" defaultValue={defaults?.rate_type ?? "reducing"}>
            <option value="reducing">Reducing balance (standard)</option>
            <option value="flat">Flat rate</option>
          </Select>
        </Field>
        <Field label="Documentation charge (₹)" hint="Flat fee per loan, optional">
          <Input name="doc_charge" type="number" step="0.01" min="0" defaultValue={defaults?.doc_charge ?? ""} placeholder="e.g. 500" />
        </Field>
        <Field label="Processing fee (%)" hint="% of loan amount, optional">
          <Input name="processing_fee_pct" type="number" step="0.01" min="0" max="10" defaultValue={defaults?.processing_fee_pct ?? ""} placeholder="e.g. 1.5" />
        </Field>
        <Field label="Round EMI to nearest ₹" hint="0 = no rounding. E.g. 100 rounds ₹3,247 up to ₹3,300">
          <Input name="round_to" type="number" step="1" min="0" max="10000" defaultValue={defaults?.round_to ?? 0} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Input name="notes" defaultValue={defaults?.notes ?? ""} placeholder="e.g. Contact person, branch, special terms" />
        </Field>
      </div>
      {state.error ? <Notice tone="bad">{state.error}</Notice> : null}
      <div className="flex justify-end gap-2">
        <a href="/finance" className="inline-flex h-10 items-center rounded-lg border border-line-2 px-4 text-sm font-semibold text-ink-2 hover:bg-surface-2">Cancel</a>
        <Button variant="primary" disabled={pending}>{pending ? "Saving…" : id ? "Save changes" : "Add financier"}</Button>
      </div>
    </form>
  );
}

export function ToggleActive({ id, active }: { id: number; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => toggleFinancier(id, !active))}
      className="text-[13px] font-semibold text-ink-2 hover:text-ink disabled:opacity-50">
      {active ? "Deactivate" : "Activate"}
    </button>
  );
}

export function DeleteFinancier({ id }: { id: number }) {
  const [state, run, pending] = useActionState<FinancierState, FormData>(deleteFinancierAction.bind(null, id), {});
  return (
    <form action={run} className="inline">
      {state.error ? <span className="text-xs text-bad">{state.error}</span> : null}
      <button type="submit" disabled={pending}
        onClick={(e) => { if (!confirm("Delete this financier? This cannot be undone.")) e.preventDefault(); }}
        className="text-[13px] font-semibold text-bad hover:underline disabled:opacity-50">
        {pending ? "Deleting…" : "Delete"}
      </button>
    </form>
  );
}
