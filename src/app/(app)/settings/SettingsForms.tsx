"use client";

import { useActionState, useState, useTransition } from "react";
import { Badge, Button, cx, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { GST_STATES } from "@/lib/format";
import type { Shop } from "@/lib/shop";
import { addBrand, addCategory, addModels, addUser, changePassword, removeLogo, saveShop, setUserActive, toggleModel, uploadLogo, type SettingsState } from "./actions";

function Msg({ s }: { s: SettingsState }) {
  return s.error ? <Notice tone="bad">{s.error}</Notice> : s.ok ? <Notice tone="good">{s.ok}</Notice> : null;
}

export function ShopForm({ shop }: { shop: Shop }) {
  const [state, action, pending] = useActionState(saveShop, {});
  return (
    <>
    <LogoForm url={shop.logo_url} />
    <form action={action} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
      <Field label="Shop name" className="sm:col-span-2"><Input name="shop_name" defaultValue={shop.shop_name} required /></Field>
      <Field label="Address" className="sm:col-span-2"><Textarea name="address" rows={2} defaultValue={shop.address} /></Field>
      <Field label="Phone"><Input name="phone" defaultValue={shop.phone} /></Field>
      <Field label="Email"><Input name="email" type="email" defaultValue={shop.email} /></Field>
      <Field label="GSTIN" hint="Your state is read from the first two digits"><Input name="gstin" defaultValue={shop.gstin} className="font-mono uppercase" maxLength={15} /></Field>
      <Field label="State (if no GSTIN)">
        <Select name="state_code" defaultValue={shop.state_code}>
          {Object.entries(GST_STATES).map(([c, n]) => <option key={c} value={c}>{c} – {n}</option>)}
        </Select>
      </Field>
      <Field label="Invoice number prefix" hint="Invoices are numbered PREFIX/26-27/00001"><Input name="invoice_prefix" defaultValue={shop.invoice_prefix} className="font-mono uppercase" maxLength={6} /></Field>
      <Field label="Invoice footer"><Input name="invoice_footer" defaultValue={shop.invoice_footer} /></Field>
      <div className="flex flex-col gap-3 sm:col-span-2"><Msg s={state} /><Button variant="primary" disabled={pending} className="self-end">{pending ? "Saving…" : "Save shop details"}</Button></div>
    </form>
    </>
  );
}

function LogoForm({ url }: { url: string | null }) {
  const [state, action, pending] = useActionState(uploadLogo, {});
  const [removed, setRemoved] = useState<SettingsState>({});
  const [busy, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 border-b border-line p-5">
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="Shop logo" className="h-full w-full object-cover" /> : <span className="text-xs text-ink-3">No logo</span>}
        </div>
        <form action={action} className="flex flex-1 flex-wrap items-center gap-2">
          <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Logo image"
            className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-lg file:border file:border-line-2 file:bg-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink" />
          <Button size="sm" disabled={pending}>{pending ? "Uploading…" : "Upload logo"}</Button>
          {url ? <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => start(async () => setRemoved(await removeLogo()))}>Remove</Button> : null}
        </form>
      </div>
      <p className="text-xs text-ink-3">Shown on invoices, the sidebar and the sign-in page. PNG, JPG or WebP, under 1 MB.</p>
      <Msg s={state.error || state.ok ? state : removed} />
    </div>
  );
}

export function UsersSettings({ users, me }: { users: { id: number; name: string; username: string; role: string; active: boolean }[]; me: number }) {
  const [state, action, pending] = useActionState(addUser, {});
  const [msg, setMsg] = useState<SettingsState>({});
  const [busy, start] = useTransition();
  return (
    <div className="flex flex-col gap-5 p-5">
      <ul className="divide-y divide-line rounded-lg border border-line">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">{u.name} {u.id === me ? <span className="text-ink-3">(you)</span> : null}</p>
              <p className="text-xs text-ink-3">{u.username}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={u.role === "owner" ? "primary" : "neutral"}>{u.role}</Badge>
              {!u.active ? <Badge tone="bad">Disabled</Badge> : null}
              {u.id !== me ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => start(async () => setMsg(await setUserActive(u.id, !u.active)))}>
                  {u.active ? "Disable" : "Enable"}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Msg s={msg} />
      <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <p className="text-sm font-semibold sm:col-span-2">Add a login</p>
        <Field label="Name"><Input name="name" /></Field>
        <Field label="Username"><Input name="username" autoComplete="off" /></Field>
        <Field label="Password" hint="At least 8 characters"><Input name="password" type="password" autoComplete="new-password" /></Field>
        <Field label="Role"><Select name="role"><option value="staff">Staff</option><option value="owner">Owner</option></Select></Field>
        <div className="flex flex-col gap-3 sm:col-span-2"><Msg s={state} /><Button disabled={pending} className="self-end">{pending ? "Adding…" : "Add login"}</Button></div>
      </form>
    </div>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, {});
  return (
    <form action={action} className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
      <Field label="Current password"><Input name="current" type="password" autoComplete="current-password" /></Field>
      <Field label="New password"><Input name="password" type="password" autoComplete="new-password" /></Field>
      <div className="flex flex-col gap-3 sm:col-span-2"><Msg s={state} /><Button disabled={pending} className="self-end">{pending ? "Saving…" : "Change password"}</Button></div>
    </form>
  );
}

type Brand = { id: number; name: string; is_universal: boolean };
type Model = { id: number; brand_id: number; name: string; active: boolean; parts: number };

export function CatalogSettings({ brands, models, categories }: { brands: Brand[]; models: Model[]; categories: { id: number; name: string }[] }) {
  const real = brands.filter((b) => !b.is_universal);
  const [brandId, setBrandId] = useState(real[0]?.id ?? 0);
  const [brandState, brandAction] = useActionState(addBrand, {});
  const [catState, catAction] = useActionState(addCategory, {});
  const [modelState, modelAction, modelPending] = useActionState(addModels.bind(null, brandId), {});
  const [, start] = useTransition();
  const list = models.filter((m) => m.brand_id === brandId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {real.map((b) => (
            <li key={b.id}>
              <button onClick={() => setBrandId(b.id)}
                className={cx("flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap", b.id === brandId ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-surface-2")}>
                {b.name}<span className="text-xs text-ink-3">{models.filter((m) => m.brand_id === b.id && m.active).length}</span>
              </button>
            </li>
          ))}
        </ul>
        <form action={brandAction} className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <Input name="name" placeholder="New brand, e.g. Ather" />
          <Button size="sm">Add brand</Button>
          <Msg s={brandState} />
        </form>
      </div>
      <div className="flex flex-col gap-5 p-5">
        <div>
          <p className="mb-3 text-sm text-ink-2">Tap a model to hide it from forms and filters (parts that fit it keep the link). Hidden models are greyed out.</p>
          <div className="flex flex-wrap gap-2">
            {list.map((m) => (
              <button key={m.id} onClick={() => start(() => toggleModel(m.id, !m.active))}
                className={cx("rounded-full border px-3 py-1.5 text-[13px] font-medium", m.active ? "border-line-2 bg-surface text-ink hover:border-ink-3" : "border-dashed border-line-2 text-ink-3 line-through")}>
                {m.name}<span className="ml-1.5 text-xs text-ink-3">{m.parts}</span>
              </button>
            ))}
            {!list.length ? <p className="text-sm text-ink-3">No models yet.</p> : null}
          </div>
        </div>
        <form action={modelAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label="Add models to this brand" hint="Separate several with commas" className="flex-1"><Input name="names" key={brandId} placeholder="e.g. Jupiter 110 (2024), Ntorq Race XP" /></Field>
          <Button disabled={modelPending}>Add models</Button>
        </form>
        <Msg s={modelState} />
        <div className="border-t border-line pt-5">
          <p className="mb-3 text-sm font-semibold">Categories</p>
          <div className="mb-3 flex flex-wrap gap-2">{categories.map((c) => <Badge key={c.id}>{c.name}</Badge>)}</div>
          <form action={catAction} className="flex max-w-md gap-2"><Input name="name" placeholder="New category" /><Button>Add</Button></form>
          <div className="mt-2"><Msg s={catState} /></div>
        </div>
      </div>
    </div>
  );
}
