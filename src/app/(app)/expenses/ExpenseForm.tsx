"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  Check, Coffee, FileText, Home, Landmark, Loader2, MoreHorizontal, Package, Pencil, Plus, Smartphone, Tag, Trash2, Truck, Users, Wrench, X, Zap,
} from "lucide-react";
import { Button, Card, CardHeader, cx, Field, Input, Notice, Select } from "@/components/ui";
import { DatePicker } from "@/components/DatePicker";
import { BUSINESSES, EXPENSE_CATEGORIES, EXPENSE_MODES } from "@/lib/expenses";
import { isoDate } from "@/lib/format";
import { addExpense, createCategoryAction, deleteExpense, renameCategoryAction, type ExpenseState } from "./actions";

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
export function ExpenseForm({ usedCategories, customCategories = [], business: initialBusiness }: { usedCategories: string[]; customCategories?: string[]; business?: string }) {
  const [state, action, pending] = useActionState<ExpenseState, FormData>(addExpense, {});
  // Remembered across saves: staff usually enter several expenses for the same business in a row.
  const [business, setBusiness] = useState(initialBusiness ?? "");
  // Most-used first, then the remaining standard ones; "Other" always last.
  const categories = [...new Set([...usedCategories, ...EXPENSE_CATEGORIES])].sort((a, b) => Number(a === "Other") - Number(b === "Other"));
  const customSet = new Set(customCategories);
  return (
    <Card className="xl:sticky xl:top-6 xl:self-start">
      <CardHeader title="Add expense" sub="Rent, salaries, bills, freight: anything either business pays for" />
      {/* key resets the fields after each save */}
      <form key={state.key ?? 0} action={action} className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">Date</span>
            <DatePicker name="date" defaultValue={isoDate()} max={isoDate()} ariaLabel="Expense date" />
          </div>
          <Field label="Amount ₹"><Input name="amount" inputMode="decimal" placeholder="0" required autoFocus /></Field>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">For which business</legend>
          <input type="hidden" name="business" value={business} />
          <div role="radiogroup" aria-label="Business" className="grid grid-cols-3 gap-1.5">
            {Object.entries(BUSINESSES).map(([k, b]) => (
              <button key={k} type="button" role="radio" aria-checked={business === k} onClick={() => setBusiness(k)} title={b.hint}
                className={cx("rounded-lg border px-2 py-2 text-[13px] font-semibold transition-colors",
                  business === k ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-2 hover:border-line-2 hover:text-ink")}>
                {b.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-ink-3">{business ? BUSINESSES[business].hint : "Shared = costs both businesses use, like rent"}</span>
        </fieldset>
        <CategoryPicker categories={categories} customSet={customSet} />
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
function CategoryPicker({ categories: initialCategories, customSet: initialCustomSet }: { categories: string[]; customSet: Set<string> }) {
  const [categories, setCategories] = useState(initialCategories);
  const [customSet, setCustomSet] = useState(initialCustomSet);
  const [value, setValue] = useState("");
  const [custom, setCustom] = useState(false);
  const [newName, setNewName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savePending, startSave] = useTransition();
  // Inline rename state
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [editPending, startEdit] = useTransition();
  const editInput = useRef<HTMLInputElement>(null);
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

  const openNew = () => { setCustom(true); setNewName(""); setValue(""); setSaveError(""); setEditingCat(null); setTimeout(() => customInput.current?.focus(), 0); };
  const cancelNew = () => { setCustom(false); setNewName(""); setSaveError(""); };

  const openEdit = (cat: string) => {
    setEditingCat(cat); setEditName(cat); setEditError("");
    setCustom(false); setNewName("");
    setTimeout(() => editInput.current?.focus(), 0);
  };
  const cancelEdit = () => { setEditingCat(null); setEditName(""); setEditError(""); };

  const saveEdit = (oldName: string) => {
    const name = editName.trim();
    if (!name || name === oldName) { cancelEdit(); return; }
    setEditError("");
    startEdit(async () => {
      const result = await renameCategoryAction(oldName, name);
      if (result.error) { setEditError(result.error); return; }
      setCategories((prev) => prev.map((c) => (c === oldName ? name : c)));
      setCustomSet((prev) => { const next = new Set(prev); next.delete(oldName); next.add(name); return next; });
      if (value === oldName) setValue(name);
      cancelEdit();
    });
  };

  const saveCategory = () => {
    const name = newName.trim();
    if (!name) return;
    setSaveError("");
    startSave(async () => {
      const fd = new FormData();
      fd.set("name", name);
      const result = await createCategoryAction({}, fd);
      if (result.error) { setSaveError(result.error); return; }
      // Add to local list (before "Other"), select it, close the input
      setCategories((prev) => prev.includes(name) ? prev : [...prev.filter((c) => c !== "Other"), name, ...(prev.includes("Other") ? ["Other"] : [])]);
      setValue(name);
      setNewName("");
      setCustom(false);
    });
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
          const isCustom = customSet.has(c);

          if (editingCat === c) {
            return (
              <div key={c} className="col-span-2 sm:col-span-3 xl:col-span-2 flex gap-2">
                <Input
                  ref={editInput} value={editName} onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(c); } if (e.key === "Escape") cancelEdit(); }}
                  maxLength={60} aria-label="Rename category" className="flex-1 text-[13px]"
                />
                <button type="button" onClick={() => saveEdit(c)} disabled={editPending}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-ink hover:opacity-90 disabled:opacity-50">
                  {editPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={cancelEdit}
                  className="flex shrink-0 items-center rounded-lg border border-line px-2.5 text-ink-3 hover:text-ink">
                  <X className="h-3.5 w-3.5" />
                </button>
                {editError && <p className="text-[12px] text-red-500">{editError}</p>}
              </div>
            );
          }

          return (
            <div key={c} className="group relative">
              <button
                type="button" role="radio" aria-checked={on}
                tabIndex={on || (!value && i === 0) ? 0 : -1}
                onClick={() => pick(c)} onKeyDown={(e) => onKey(e, i)}
                className={cx(
                  "flex min-w-0 w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                  on ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-2 hover:border-line-2 hover:text-ink",
                )}
              >
                <Icon className={cx("h-4 w-4 shrink-0", on ? "text-primary" : "text-ink-3")} />
                <span className="min-w-0 flex-1 truncate">{c}</span>
                {on ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
              {isCustom && (
                <button type="button" onClick={() => openEdit(c)} aria-label={`Rename ${c}`}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-surface-2 hover:text-ink focus:opacity-100">
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {custom ? (
        <div className="mt-1 space-y-2">
          <Input
            ref={customInput} value={newName}
            onChange={(e) => { setNewName(e.target.value); setValue(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveCategory(); } }}
            placeholder="e.g. Diwali bonus, Vehicle insurance" maxLength={60} aria-label="New category name"
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={!newName.trim() || savePending} onClick={saveCategory}>
              {savePending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : "Save category"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelNew}>Cancel</Button>
          </div>
          {saveError && <p className="text-[12px] text-red-500">{saveError}</p>}
          <p className="text-[11.5px] text-ink-3">
            "Save category" adds it to the list for future use. You can also just type here and fill the expense below.
          </p>
        </div>
      ) : (
        <button type="button" onClick={openNew}
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
