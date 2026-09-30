"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  Check, Coffee, FileText, Home, Landmark, MoreHorizontal, Package, Plus, Smartphone, Tag, Trash2, Truck, Users, Wrench, Zap,
} from "lucide-react";
import { Button, Card, CardHeader, cx, Field, Input, Notice, Select } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { EXPENSE_CATEGORIES, EXPENSE_MODES } from "@/lib/expenses";
import { isoDate } from "@/lib/format";
import { addExpense, deleteExpense, type ExpenseState } from "./actions";

const ICONS: Record<string, React.ElementType> = {
  Rent: Home,
  "Salary & wages": Users,
  Electricity: Zap,
  "Transport & freight": Truck,
  "Phone & internet": Smartphone,
  "Tea & refreshments": Coffee,
  "Shop maintenance": Wrench,
  "Packing material": Package,
  "Bank charges": Landmark,
  "Taxes & fees": FileText,
  Other: MoreHorizontal,
};

/** usedCategories: this shop's categories, most used first. */
export function ExpenseForm({ usedCategories }: { usedCategories: string[] }) {
  const [state, action, pending] = useActionState<ExpenseState, FormData>(addExpense, {});
  // Most-used first, then the remaining standard ones; "Other" always last.
  const categories = [...new Set([...usedCategories, ...EXPENSE_CATEGORIES])].sort((a, b) => Number(a === "Other") - Number(b === "Other"));
  return (
    <Card className="xl:sticky xl:top-6 xl:self-start">
      <CardHeader title="Add expense" sub="Rent, salaries, bills, freight — anything the shop pays for" />
      {/* key resets the fields after each save */}
      <form key={state.key ?? 0} action={action} className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">Date</span>
            <DatePicker name="date" defaultValue={isoDate()} max={isoDate()} ariaLabel="Expense date" />
          </div>
          <Field label="Amount ₹"><Input name="amount" inputMode="decimal" placeholder="0" required autoFocus /></Field>
        </div>
        <CategoryPicker categories={categories} />
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

/** One-tap category buttons with a "+ New" option for the shop's own categories. */
function CategoryPicker({ categories }: { categories: string[] }) {
  const [value, setValue] = useState("");
  const [custom, setCustom] = useState(false);
  const customInput = useRef<HTMLInputElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  // The browser blocks saving (and shows this message) until a category is chosen.
  useEffect(() => { hidden.current?.setCustomValidity(value.trim() ? "" : "Choose a category."); }, [value]);

  const pick = (c: string) => { setCustom(false); setValue(c); };
  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + categories.length) % categories.length;
    pick(categories[next]);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <fieldset className="relative flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-medium text-ink-2">
        Category {value && !custom ? <span className="font-normal text-ink-3">· {value}</span> : null}
      </legend>
      {/* Carries the chosen category to the form. */}
      <input
        ref={hidden} type="text" name="category" value={value.trim()} onChange={() => {}} tabIndex={-1} aria-hidden
        className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
      />
      <div role="radiogroup" aria-label="Expense category" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-2">
        {categories.map((c, i) => {
          const Icon = ICONS[c] ?? Tag;
          const on = !custom && value === c;
          return (
            <button
              key={c} type="button" role="radio" aria-checked={on}
              tabIndex={on || (!value && i === 0) ? 0 : -1}
              onClick={() => pick(c)} onKeyDown={(e) => onKey(e, i)}
              className={cx(
                "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                on ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-2 hover:border-line-2 hover:text-ink",
              )}
            >
              <Icon className={cx("h-4 w-4 shrink-0", on ? "text-primary" : "text-ink-3")} />
              <span className="min-w-0 flex-1 truncate">{c}</span>
              {on ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
            </button>
          );
        })}
      </div>
      {custom ? (
        <div className="mt-1 flex gap-2">
          <Input ref={customInput} value={value} onChange={(e) => setValue(e.target.value)} placeholder="New category, e.g. Diwali bonus" maxLength={60} aria-label="New category name" />
          <Button type="button" variant="ghost" onClick={() => { setCustom(false); setValue(""); }}>Cancel</Button>
        </div>
      ) : (
        <button type="button" onClick={() => { setCustom(true); setValue(""); setTimeout(() => customInput.current?.focus(), 0); }}
          className="mt-1 inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" /> New category
        </button>
      )}
    </fieldset>
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
