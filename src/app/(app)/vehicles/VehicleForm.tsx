"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { DatePicker } from "@/components/DatePicker";
import { NumberPlate } from "@/components/NumberPlate";
import { Button, Card, CardHeader, cx, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { isoDate as today } from "@/lib/format";
import { CONDITIONS, DOC_CHECKLIST, FUELS, INSURANCE_TYPES, LOAN_IN_COST, LOAN_PAID_BY, LOAN_STATUS, parseReg, RC_STATUS, RC_TYPES, VEHICLE_STATUS } from "@/lib/regno";
import type { Catalog } from "@/lib/products";
import type { Vehicle } from "@/lib/vehicles";
import { saveVehicle, type VehicleState } from "./actions";

const n = (v: number | null | undefined) => (v == null ? "" : String(v));

export function VehicleForm({ catalog, initial, regNo }: { catalog: Catalog; initial?: Vehicle; regNo?: string }) {
  const router = useRouter();
  const isNew = !initial;
  const [state, action, pending] = useActionState<VehicleState, FormData>(saveVehicle.bind(null, initial?.id ?? null), {});
  const [reg, setReg] = useState(initial?.reg_no ?? regNo ?? "");
  const [brandId, setBrandId] = useState(initial?.brand_id ? String(initial.brand_id) : "");
  const [make, setMake] = useState(initial?.make ?? "");
  const [buy, setBuy] = useState(n(initial?.purchase_price));
  const [closure, setClosure] = useState(n(initial?.loan_closure_amount));
  const [paidBy, setPaidBy] = useState(initial?.loan_paid_by ?? "");
  const [financier, setFinancier] = useState(initial?.hypothecation ?? "");
  const [market, setMarket] = useState(n(initial?.market_price));
  const [ours, setOurs] = useState(n(initial?.our_price));
  const [loanStatus, setLoanStatus] = useState(initial?.loan_status ?? "none");
  const hasLoan = loanStatus !== "none";
  const [docs, setDocs] = useState<Set<string>>(new Set(initial?.docs_in_hand ?? []));
  const toggleDoc = (k: string) => setDocs((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  useEffect(() => {
    if (state.ok && state.id) router.push(`/vehicles/${state.id}?saved=1`);
  }, [state, router]);

  const info = parseReg(reg);
  const brands = catalog.brands.filter((b) => !b.is_universal);
  const models = useMemo(() => catalog.models.filter((m) => String(m.brand_id) === brandId), [catalog, brandId]);
  // When the seller's loan is cleared as part of the deal (by us, or later by our buyer), the bike costs:
  // paid to owner + loan closure. Only a shop-paid closure is our own cash.
  const shopPays = loanStatus !== "none" && LOAN_IN_COST.includes(paidBy);
  const loanCost = shopPays ? Number(closure) || 0 : 0;
  const totalCost = (Number(buy) || 0) + loanCost;
  const [deal, setDeal] = useState(initial?.purchase_price != null && LOAN_IN_COST.includes(initial.loan_paid_by) && initial.loan_closure_amount != null
    ? String(Number(initial.purchase_price) + Number(initial.loan_closure_amount)) : "");
  const onDeal = (v: string) => { setDeal(v); if (Number(v) && loanCost) setBuy(String(Math.max(0, Number(v) - loanCost))); };
  const onClosure = (v: string) => { setClosure(v); if (shopPays && Number(deal)) setBuy(String(Math.max(0, Number(deal) - (Number(v) || 0)))); };
  const margin = Number(ours) && totalCost ? Number(ours) - totalCost : null;

  return (
    // Submit through onSubmit rather than the action prop: React resets an action form after every submit,
    // which would wipe this long form whenever the server rejects it (e.g. a duplicate vehicle number).
    <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); startTransition(() => action(f)); }} className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Vehicle" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="regNo" className="text-[13px] font-medium text-ink-2">Vehicle number</label>
            <div className="flex items-center gap-3">
              <Input id="regNo" name="regNo" value={reg} onChange={(e) => setReg(e.target.value)} required autoFocus={isNew && !regNo}
                spellCheck={false} autoComplete="off" placeholder="TN 76 AB 1234" className="font-mono tracking-wider uppercase" />
              {info.valid ? <NumberPlate reg={reg} className="hidden sm:inline-flex" /> : null}
            </div>
            <span className={cx("text-xs", reg && !info.valid ? "text-bad" : "text-ink-3")}>
              {!reg ? "As printed on the RC" : !info.valid ? "Not a valid number yet: TN 76 AB 1234 or 22 BH 1234 AA"
                : info.kind === "state" ? `${info.state} · RTO ${info.rto}` : `Bharat series · ${info.year}`}
            </span>
          </div>
          <Field label="Status">
            <Select name="status" defaultValue={initial?.status ?? "in_stock"}>
              {Object.entries(VEHICLE_STATUS).filter(([k]) => k !== "sold" || initial?.status === "sold").map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Condition">
            <Select name="condition" defaultValue={initial?.condition ?? "good"}>{CONDITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          </Field>
          <Field label="Brand">
            <Select name="brandId" value={brandId} onChange={(e) => { setBrandId(e.target.value); setMake(brands.find((b) => String(b.id) === e.target.value)?.name ?? ""); }}>
              <option value="">Other / not listed</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          {!brandId ? <Field label="Make (as on RC)"><Input name="make" value={make} onChange={(e) => setMake(e.target.value)} placeholder="e.g. Yamaha" /></Field>
            : <input type="hidden" name="make" value={make} />}
          <Field label="Model">
            <Input name="model" list="vehicle-models" defaultValue={initial?.model} required placeholder={models[0]?.name ?? "e.g. Splendor Plus"} />
            <datalist id="vehicle-models">{models.map((m) => <option key={m.id} value={m.name} />)}</datalist>
          </Field>
          <Field label="Variant"><Input name="variant" defaultValue={initial?.variant} placeholder="e.g. Disc, BS6" /></Field>
          <Field label="Year of manufacture"><Input name="mfgYear" inputMode="numeric" maxLength={4} defaultValue={n(initial?.mfg_year)} placeholder="2019" /></Field>
          <Field label="Registration date"><DatePicker name="regDate" defaultValue={initial?.reg_date ?? ""} max={today()} ariaLabel="Registration date" /></Field>
          <Field label="Colour"><Input name="colour" defaultValue={initial?.colour} placeholder="Black" /></Field>
          <Field label="Fuel">
            <Select name="fuel" defaultValue={initial?.fuel ?? "Petrol"}>{FUELS.map((x) => <option key={x}>{x}</option>)}</Select>
          </Field>
          <Field label="Engine cc"><Input name="engineCc" inputMode="numeric" defaultValue={n(initial?.engine_cc)} placeholder="110" /></Field>
          <Field label="Odometer (km)"><Input name="odometerKm" inputMode="numeric" defaultValue={n(initial?.odometer_km)} placeholder="24500" /></Field>
          <Field label="Chassis number" className="sm:col-span-2"><Input name="chassisNo" defaultValue={initial?.chassis_no} className="font-mono uppercase" /></Field>
          <Field label="Engine number" className="sm:col-span-2"><Input name="engineNo" defaultValue={initial?.engine_no} className="font-mono uppercase" /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Owner" sub="As per the RC. Add earlier owners from the bike page after saving." />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Current owner name" className="sm:col-span-2"><Input name="currentOwner" defaultValue={initial?.current_owner} /></Field>
          <Field label="Owner phone"><Input name="ownerPhone" type="tel" inputMode="tel" defaultValue={initial?.owner_phone} /></Field>
          <Field label="Number of owners" hint="Owner serial no. on the RC"><Input name="ownerCount" inputMode="numeric" defaultValue={initial?.owner_count ?? 1} /></Field>
          <Field label="Owner address" className="sm:col-span-2 lg:col-span-4"><Input name="ownerAddress" defaultValue={initial?.owner_address} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Papers" sub="RC, insurance and PUC details. We warn you 15 days before insurance or PUC expires." />
        <Section title="RC (registration certificate)">
          <Field label="RC status">
            <Select name="rcStatus" defaultValue={initial?.rc_status ?? "original"}>
              {Object.entries(RC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label="RC type">
            <Select name="rcType" defaultValue={initial?.rc_type ?? "smart_card"}>
              {Object.entries(RC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Owner name on RC" hint="Exactly as printed"><Input name="rcOwnerName" defaultValue={initial?.rc_owner_name} /></Field>
          <Field label="Registering authority" hint={info.valid && info.kind === "state" ? `RTO code ${info.rto}` : undefined}>
            <Input name="rtoOffice" defaultValue={initial?.rto_office} placeholder="e.g. RTO Tenkasi" />
          </Field>
          <Field label="RC valid till" hint="Usually 15 years from registration"><DatePicker name="rcValidTill" defaultValue={initial?.rc_valid_till ?? ""} ariaLabel="RC valid till" /></Field>
        </Section>
        <Section title="Insurance">
          <Field label="Insurance company"><Input name="insuranceCompany" defaultValue={initial?.insurance_company} placeholder="e.g. New India Assurance" /></Field>
          <Field label="Policy number"><Input name="insurancePolicyNo" defaultValue={initial?.insurance_policy_no} className="font-mono" /></Field>
          <Field label="Policy type">
            <Select name="insuranceType" defaultValue={initial?.insurance_type ?? ""}>
              <option value="">—</option>
              {Object.entries(INSURANCE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="IDV ₹" hint="Insured value on the policy"><Input name="insuranceIdv" inputMode="decimal" defaultValue={n(initial?.insurance_idv)} /></Field>
          <Field label="Insurance valid till"><DatePicker name="insuranceValidTill" defaultValue={initial?.insurance_valid_till ?? ""} ariaLabel="Insurance valid till" /></Field>
        </Section>
        <Section title="PUC">
          <Field label="PUC certificate no."><Input name="pucCertNo" defaultValue={initial?.puc_cert_no} className="font-mono uppercase" /></Field>
          <Field label="PUC valid till"><DatePicker name="pucValidTill" defaultValue={initial?.puc_valid_till ?? ""} ariaLabel="PUC valid till" /></Field>
        </Section>
        <div className="border-t border-line p-5">
          <p className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">
            Documents we have <span className="font-medium tracking-normal normal-case">{docs.size} of {DOC_CHECKLIST.length} · tap to tick</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {DOC_CHECKLIST.map((d) => {
              const on = docs.has(d.key);
              return (
                <button key={d.key} type="button" aria-pressed={on} onClick={() => toggleDoc(d.key)}
                  className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                    on ? "border-primary bg-primary text-primary-ink" : "border-line-2 bg-surface text-ink-2 hover:border-ink-3 hover:text-ink")}>
                  {on ? <Check className="h-3.5 w-3.5" /> : null}{d.label}
                </button>
              );
            })}
          </div>
          {[...docs].map((k) => <input key={k} type="hidden" name="docs" value={k} />)}
        </div>
      </Card>

      <Card>
        <CardHeader title="Financier / loan" sub="From the RC (hypothecation) and the financier's statement" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Loan status" hint={LOAN_STATUS[loanStatus]?.help} className="sm:col-span-2">
            <Select name="loanStatus" value={loanStatus} onChange={(e) => setLoanStatus(e.target.value)}>
              {Object.entries(LOAN_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          {hasLoan ? (
            <>
              <Field label="Financier / bank"><Input name="hypothecation" value={financier} onChange={(e) => setFinancier(e.target.value)} required placeholder="e.g. Shriram Finance" /></Field>
              <Field label="Branch"><Input name="loanBranch" defaultValue={initial?.loan_branch} placeholder="e.g. Tenkasi" /></Field>
              <Field label="Loan account no."><Input name="loanAccountNo" defaultValue={initial?.loan_account_no} className="font-mono uppercase" /></Field>
              <Field label="Loan amount ₹"><Input name="loanAmount" inputMode="decimal" defaultValue={n(initial?.loan_amount)} /></Field>
              <Field label="EMI ₹ / month"><Input name="loanEmi" inputMode="decimal" defaultValue={n(initial?.loan_emi)} /></Field>
              <Field label="Tenure (months)"><Input name="loanTenureMonths" inputMode="numeric" defaultValue={n(initial?.loan_tenure_months)} placeholder="e.g. 24" /></Field>
              <Field label="Loan started"><DatePicker name="loanStart" defaultValue={initial?.loan_start ?? ""} max={today()} ariaLabel="Loan started" /></Field>
              <Field label="Loan ends"><DatePicker name="loanEnd" defaultValue={initial?.loan_end ?? ""} ariaLabel="Loan ends" /></Field>
              {loanStatus === "active" ? (
                <Field label="EMIs still pending"><Input name="loanEmisPending" inputMode="numeric" defaultValue={n(initial?.loan_emis_pending)} /></Field>
              ) : null}
              <Field label={loanStatus === "active" ? "Amount to close the loan ₹" : "Closure amount paid ₹"} hint="Foreclosure / settlement amount">
                <Input name="loanClosureAmount" inputMode="decimal" value={closure} onChange={(e) => onClosure(e.target.value)} />
              </Field>
              <Field label={loanStatus === "active" ? "Who will pay it" : "Who paid it"} hint="Shop or buyer: added to the bike's cost">
                <Select name="loanPaidBy" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                  <option value="">—</option>
                  {Object.entries(LOAN_PAID_BY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              {loanStatus !== "active" ? (
                <Field label="Loan closed on"><DatePicker name="loanClosedOn" defaultValue={initial?.loan_closed_on ?? ""} max={today()} ariaLabel="Loan closed on" /></Field>
              ) : null}
              {loanStatus === "noc_received" || loanStatus === "removed" ? (
                <>
                  <Field label="NOC number"><Input name="nocNumber" defaultValue={initial?.noc_number} className="font-mono" /></Field>
                  <Field label="NOC date"><DatePicker name="nocDate" defaultValue={initial?.noc_date ?? ""} max={today()} ariaLabel="NOC date" /></Field>
                  <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
                    <input type="checkbox" name="form35Submitted" value="yes" defaultChecked={initial?.form35_submitted || loanStatus === "removed"} className="h-4 w-4" /> Form 35 submitted to RTO
                  </label>
                </>
              ) : null}
              <Field label="Loan notes" className="sm:col-span-2 lg:col-span-4">
                <Input name="loanNotes" defaultValue={initial?.loan_notes} placeholder="e.g. Owner will close on 15th, statement collected" />
              </Field>
            </>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Prices" sub="Service and repair costs are added from the history on the bike page" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {shopPays ? (
            <Field label="Agreed deal price ₹" hint="Total agreed with the seller, loan included">
              <Input inputMode="decimal" value={deal} onChange={(e) => onDeal(e.target.value)} placeholder="e.g. 60000" />
            </Field>
          ) : null}
          <Field label={shopPays ? "Paid to owner ₹" : "We bought for ₹"}
            hint={shopPays ? "Deal price − loan closure" : loanStatus !== "none" && paidBy === "owner" ? "Owner clears the loan; it's not our cost" : undefined}>
            <Input name="purchasePrice" inputMode="decimal" value={buy} onChange={(e) => setBuy(e.target.value)} />
          </Field>
          <Field label="Bought on"><DatePicker name="purchaseDate" defaultValue={initial?.purchase_date ?? (isNew ? today() : "")} max={today()} ariaLabel="Bought on" /></Field>
          <Field label="Bought from" className={shopPays ? "" : "sm:col-span-2"}><Input name="purchasedFrom" defaultValue={initial?.purchased_from} placeholder="Seller name / dealer" /></Field>
          <Field label="Market price ₹" hint="What similar bikes sell for"><Input name="marketPrice" inputMode="decimal" value={market} onChange={(e) => setMarket(e.target.value)} /></Field>
          <Field label="Our price ₹" hint={margin != null ? `${margin >= 0 ? "Margin" : "Loss"} ₹${Math.abs(margin).toLocaleString("en-IN")} on cost, before repairs` : "Price we ask"}>
            <Input name="ourPrice" inputMode="decimal" value={ours} onChange={(e) => setOurs(e.target.value)} />
          </Field>
          <Field label="Lowest price ₹" hint="Don't sell below this"><Input name="minPrice" inputMode="decimal" defaultValue={n(initial?.min_price)} /></Field>
          {shopPays ? (
            <div className="rounded-lg bg-surface-2 px-4 py-3 text-[13px] sm:col-span-2 lg:col-span-4">
              <p className="font-semibold">Total cost of the bike: ₹{totalCost.toLocaleString("en-IN")}</p>
              <p className="text-ink-2">
                Paid to owner ₹{(Number(buy) || 0).toLocaleString("en-IN")} + loan closure to {financier.trim() || "the financier"} ₹{loanCost.toLocaleString("en-IN")}
                {paidBy === "buyer" ? " (the buyer pays this to the financier when buying, so you collect that much less)" : " (paid by us)"}.
                Service and repairs are added on top from the history.
              </p>
              {Number(buy) && loanCost && Number(deal) && Number(buy) === Number(deal) ? (
                <p className="mt-1 font-semibold text-bad">Paid to owner equals the deal price, so the loan would be counted twice. Enter only what the owner gets.</p>
              ) : null}
              {!loanCost ? <p className="mt-1 text-warn">Enter the closure amount in the Financier / loan section above.</p> : null}
            </div>
          ) : null}
          {Number(market) && Number(ours) ? (
            <p className={cx("self-end pb-2.5 text-[13px]", Number(ours) > Number(market) ? "text-warn" : "text-good")}>
              Our price is {Number(ours) > Number(market) ? "above" : "at or below"} market by ₹{Math.abs(Number(ours) - Number(market)).toLocaleString("en-IN")}
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Notes" />
        <div className="p-5"><Textarea name="notes" rows={3} defaultValue={initial?.notes} placeholder="Scratches, tyre condition, keys, anything the next salesperson should know" /></div>
      </Card>

      {state.error ? (
        <Notice tone="bad">{state.error}{state.id ? <> <Link className="font-semibold underline" href={`/vehicles/${state.id}`}>Open it</Link></> : null}</Notice>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button variant="primary" disabled={pending}>{pending ? "Saving…" : isNew ? "Add bike" : "Save changes"}</Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line p-5 first-of-type:border-t-0">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="mb-3 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">{title}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  );
}
