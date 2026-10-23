import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { vehicleDocPdfPath } from "@/lib/pdf/link";
import { getShop } from "@/lib/shop";
import { buildDocModel, loadVehicleDoc, type DocParty } from "@/lib/vehicle-docs";
import { DocActions } from "../../VehicleDocs";

export const metadata: Metadata = { title: "Bike document" };

export default async function VehicleDocPage({ params, searchParams }: PageProps<"/vehicles/[id]/documents/[docId]">) {
  const user = await requireUser();
  const { id, docId } = await params;
  const { new: isNew } = await searchParams;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(docId)) notFound();
  const [data, shop] = await Promise.all([loadVehicleDoc(Number(docId)), getShop()]);
  if (!data || data.doc.vehicle_id !== Number(id)) notFound();
  const { doc } = data;
  const m = buildDocModel(doc, data.shop);
  const shareText = [`*${m.shop.name}*`, `${m.title} ${m.no} · ${m.date}`, `${m.plate} · ${doc.bike.make} ${doc.bike.model}`, `${m.total[0]}: ${m.total[1]}`].join("\n");

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/vehicles/${id}`} className="flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" /> {m.plate}</Link>
        <DocActions vehicleId={Number(id)} docId={doc.id} pdfPath={vehicleDocPdfPath(doc.id)} phone={doc.party_phone} shareText={shareText}
          cancelled={m.cancelled} isOwner={user.role === "owner"} />
      </div>
      {isNew && !m.cancelled ? (
        <div className="no-print mb-5">
          <Notice tone="good"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {m.title} {m.no} is ready. Print it for both to sign, or share the PDF.</span></Notice>
        </div>
      ) : null}
      {m.cancelled ? <div className="no-print mb-5"><Notice tone="bad">This document was cancelled{m.cancelReason ? `: ${m.cancelReason}` : ""}. It keeps its number for your records.</Notice></div> : null}

      <article className="print-area relative mx-auto max-w-[900px] rounded-xl border border-line bg-surface p-6 text-sm shadow-sm sm:p-10">
        {m.cancelled ? <p aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-7xl font-black tracking-widest text-bad/15 -rotate-12">CANCELLED</p> : null}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink pb-5">
          <div className="flex max-w-md items-start gap-4">
            {shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logo_url} alt="" className="h-16 w-16 shrink-0 rounded-full" />
            ) : null}
            <div>
              <h1 className="text-xl font-bold tracking-tight">{m.shop.name}</h1>
              {m.shop.address ? <p className="mt-1 whitespace-pre-line text-ink-2">{m.shop.address}</p> : null}
              {m.shop.contact ? <p className="text-ink-2">{m.shop.contact}</p> : null}
              {m.shop.gstin ? <p className="mt-1 font-mono">GSTIN: {m.shop.gstin}</p> : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-bold tracking-[0.2em] text-primary uppercase">{m.title}</p>
            <p className="mt-1 font-mono text-lg font-semibold">{m.no}</p>
            <p className="text-ink-2">{m.date}</p>
          </div>
        </header>

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          <PartyBox p={m.seller} />
          <PartyBox p={m.buyer} />
        </section>

        <section className="mt-4 rounded-lg border border-line p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">Vehicle</p>
            <span className="rounded border-2 border-ink px-3 py-0.5 font-mono text-base font-bold tracking-widest">{m.plate}</span>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {m.vehicle.map(([k, v]) => (
              <div key={k}><dt className="text-xs text-ink-3">{k}</dt><dd className="font-semibold">{v}</dd></div>
            ))}
          </dl>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg border border-line p-4">
            <p className="text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">Payment</p>
            <dl className="num mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5">
              {m.money.map(([k, v]) => <div key={k} className="contents"><dt className="text-ink-2">{k}</dt><dd className="text-right">{v}</dd></div>)}
              <dt className="mt-1 border-t-2 border-ink pt-2 text-base font-bold">{m.total[0]}</dt>
              <dd className="mt-1 border-t-2 border-ink pt-2 text-right text-base font-bold">{m.total[1]}</dd>
            </dl>
            <p className="mt-2 text-xs text-ink-3">{m.words}</p>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 p-4">
            <p className="text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">{m.handover[0]}</p>
            <p className="mt-1 text-base font-bold">{m.handover[1]}</p>
            <p className="mt-4 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">{m.papers.title}</p>
            {m.papers.items.length ? (
              <ul className="mt-1 flex flex-col gap-0.5">{m.papers.items.map((p) => <li key={p}>✓ {p}</li>)}</ul>
            ) : <p className="mt-1 text-ink-3">None recorded</p>}
          </div>
        </section>

        {m.notes ? <p className="mt-4 text-ink-2">Note: {m.notes}</p> : null}

        <section className="mt-5">
          <p className="text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">{m.terms.title}</p>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-[13px] text-ink-2">
            {m.terms.items.map((t) => <li key={t}>{t}</li>)}
          </ol>
        </section>

        <footer className="mt-14 grid grid-cols-2 gap-10">
          {m.signatures.map((g) => (
            <div key={g.label} className="border-t border-ink pt-2">
              <p className="font-semibold">{g.label}</p>
              <p className="text-ink-2">{g.name}</p>
            </div>
          ))}
        </footer>
      </article>
      {doc.created_by ? <p className="no-print mx-auto mt-3 max-w-[900px] text-xs text-ink-3">Issued by {doc.created_by}</p> : null}
    </>
  );
}

function PartyBox({ p }: { p: DocParty }) {
  return (
    <div className="rounded-lg border border-line p-4">
      <p className="text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">{p.role}</p>
      <p className="mt-1 text-base font-semibold">{p.name}</p>
      {p.lines.map((l) => <p key={l} className="whitespace-pre-line text-ink-2">{l}</p>)}
    </div>
  );
}
