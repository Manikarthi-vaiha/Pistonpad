"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, Notice, Select } from "@/components/ui";
import { EXPENSE_CATEGORIES, EXPENSE_MODES } from "@/lib/expenses";
import { isoDate } from "@/lib/format";
import { addExpense, deleteExpense, type ExpenseState } from "./actions";

export function ExpenseForm({ recentCategories }: { recentCategories: string[] }) {
  const [state, action, pending] = useActionState<ExpenseState, FormData>(addExpense, {});
  const categories = [...new Set([...EXPENSE_CATEGORIES, ...recentCategories])];
  return (
    <Card className="xl:sticky xl:top-6 xl:self-start">
      <CardHeader title="Add expense" sub="Rent, salaries, bills, freight — anything the shop pays for" />
      {/* key resets the fields after each save */}
      <form key={state.key ?? 0} action={action} className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" name="date" defaultValue={isoDate()} required /></Field>
          <Field label="Amount ₹"><Input name="amount" inputMode="decimal" placeholder="0" required autoFocus /></Field>
        </div>
        <Field label="Category">
          <Input name="category" list="expense-categories" placeholder="Choose or type a category" required />
          <datalist id="expense-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid by">
            <Select name="mode" defaultValue="Cash">{EXPENSE_MODES.map((m) => <option key={m}>{m}</option>)}</Select>
          </Field>
          <Field label="Paid to (optional)"><Input name="paidTo" placeholder="TNEB, landlord, driver…" /></Field>
        </div>
        <Field label="Note (optional)"><Input name="note" placeholder="Bill no., month, details" /></Field>
        {state.error ? <Notice tone="bad">{state.error}</Notice> : state.ok ? <Notice tone="good">{state.ok}</Notice> : null}
        <Button variant="primary" size="lg" disabled={pending}>{pending ? "Saving…" : "Save expense"}</Button>
      </form>
    </Card>
  );
}

export function DeleteExpense({ id }: { id: number }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm)
    return (
      <button onClick={() => setConfirm(true)} className="rounded-md p-1.5 text-ink-3 hover:bg-bad-soft hover:text-bad" aria-label="Delete expense">
        <Trash2 className="h-4 w-4" />
      </button>
    );
  return (
    <span className="flex items-center gap-1">
      <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => { await deleteExpense(id); })}>
        {pending ? "…" : "Delete"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep</Button>
    </span>
  );
}
