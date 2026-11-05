"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, Field, Input, Notice } from "@/components/ui";
import { rupees2 } from "@/lib/format";
import type { DailyReport } from "@/lib/daily-report";
import { saveOpeningBalance } from "./actions";

export function DateNav({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      defaultValue={date}
      max={today}
      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink"
      onChange={(e) => { if (e.target.value) router.push(`/reports/daily?date=${e.target.value}`); }}
    />
  );
}

function fmt(n: number) { return rupees2(n).replace("₹", ""); }

export function DailyReportClient({ report, pdfUrl }: { report: DailyReport; pdfUrl: string }) {
  const [openingInput, setOpeningInput] = useState(String(report.opening || ""));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const saveOpening = () => {
    const val = parseFloat(openingInput) || 0;
    setError(""); setSaved(false);
    start(async () => {
      const r = await saveOpeningBalance(report.date, val);
      if (r.ok) setSaved(true); else setError(r.error ?? "Failed to save.");
    });
  };

  const whatsappText = () => {
    const rows = report.rows.map((r) =>
      `${r.no}. ${r.label}: ${r.debit ? `Debit ₹${fmt(r.debit)}` : `Credit ₹${fmt(r.credit)}`}`
    ).join("\n");
    return encodeURIComponent(
      `*Daily Cash Book — ${report.date}*\n\n` +
      `Opening balance: ₹${fmt(report.opening)}\n\n` +
      rows + "\n\n" +
      `Closing balance: ₹${fmt(report.closing)}`
    );
  };

  const sections = [...new Set(report.rows.map((r) => r.section))];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Opening balance" sub="Enter the cash in hand at the start of this day" />
        <div className="flex flex-wrap items-end gap-3 p-5">
          <Field label="Opening balance ₹" className="w-52">
            <Input
              inputMode="decimal"
              value={openingInput}
              onChange={(e) => { setOpeningInput(e.target.value.replace(/[^\d.]/g, "")); setSaved(false); }}
              placeholder="0.00"
            />
          </Field>
          <Button variant="primary" onClick={saveOpening} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {saved ? <span className="text-sm text-good">Saved</span> : null}
          {error ? <Notice tone="bad">{error}</Notice> : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Day book"
          action={
            <div className="flex gap-2">
              <a
                href={`https://wa.me/?text=${whatsappText()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-surface-2"
              >
                Share
              </a>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90"
              >
                PDF
              </a>
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="num w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-wider text-ink-3 uppercase">
                <th className="px-4 py-2.5 font-semibold w-10">#</th>
                <th className="px-4 py-2.5 font-semibold">Account</th>
                <th className="px-4 py-2.5 text-right font-semibold w-36">Debit (₹)</th>
                <th className="px-4 py-2.5 text-right font-semibold w-36">Credit (₹)</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening balance */}
              <tr className="border-b border-line bg-surface-2/50 font-semibold">
                <td className="px-4 py-2.5 text-ink-3">1</td>
                <td className="px-4 py-2.5">Opening balance</td>
                <td className="px-4 py-2.5 text-right text-ink-2">—</td>
                <td className="px-4 py-2.5 text-right text-good">{fmt(report.opening)}</td>
              </tr>

              {sections.map((section) => (
                <>
                  <tr key={`sec-${section}`} className="bg-surface-2">
                    <td colSpan={4} className="px-4 py-1.5 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{section}</td>
                  </tr>
                  {report.rows.filter((r) => r.section === section).map((r) => (
                    <tr key={r.no} className="border-b border-line">
                      <td className="px-4 py-2.5 text-ink-3">{r.no + 1}</td>
                      <td className="px-4 py-2.5">{r.label}</td>
                      <td className="px-4 py-2.5 text-right text-bad">{r.debit ? fmt(r.debit) : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-good">{r.credit ? fmt(r.credit) : "—"}</td>
                    </tr>
                  ))}
                </>
              ))}

              {report.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-3">No transactions recorded for this day.</td>
                </tr>
              ) : null}

              {/* Closing balance */}
              <tr className="border-b border-line bg-surface-2/50 font-semibold">
                <td className="px-4 py-2.5 text-ink-3"></td>
                <td className="px-4 py-2.5">Closing balance</td>
                <td className="px-4 py-2.5 text-right text-bad">{fmt(report.closing)}</td>
                <td className="px-4 py-2.5 text-right text-ink-2">—</td>
              </tr>

              {/* Totals */}
              <tr className="border-t-2 border-ink text-base font-bold">
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">{fmt(report.totalDebit + report.closing)}</td>
                <td className="px-4 py-3 text-right">{fmt(report.opening + report.totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
