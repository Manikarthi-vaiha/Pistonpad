import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { sql } from "../db";
import { PDF_FONT } from "./fonts";
import { getDailyReport } from "../daily-report";
import type { DailyReport } from "../daily-report";

const INK = "#0f1a17", MUTED = "#5b6b66", LINE = "#d5ddd9", GOOD = "#0b6e4f", BAD = "#c0362c", SOFT = "#f2f6f4";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontFamily: PDF_FONT, fontSize: 9, color: INK },
  header: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: INK, marginBottom: 10 },
  shopName: { fontSize: 15, fontWeight: 700 },
  muted: { color: MUTED },
  title: { fontSize: 13, fontWeight: 700, textAlign: "right" },
  row: { flexDirection: "row" },
  th: { fontSize: 7, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, paddingVertical: 5, paddingHorizontal: 4 },
  td: { paddingVertical: 5, paddingHorizontal: 4, fontSize: 9 },
  right: { textAlign: "right" },
  bold: { fontWeight: 700 },
  section: { fontSize: 7, fontWeight: 700, color: MUTED, textTransform: "uppercase", paddingVertical: 4, paddingHorizontal: 4, backgroundColor: SOFT },
  good: { color: GOOD },
  bad: { color: BAD },
  totalRow: { flexDirection: "row", borderTopWidth: 1.5, borderTopColor: INK, marginTop: 2 },
});

const money = (n: number) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

const W = { no: "5%", label: "55%", debit: "20%", credit: "20%" };

function DailyPdfDoc({ report, shop }: { report: DailyReport; shop: { shop_name: string; address: string; phone: string } }) {
  const sections = [...new Set(report.rows.map((r) => r.section))];
  const grandTotal = report.opening + report.totalCredit;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.shopName}>{shop.shop_name}</Text>
            <Text style={[s.muted, { fontSize: 8, marginTop: 2 }]}>{shop.address}</Text>
            {shop.phone ? <Text style={[s.muted, { fontSize: 8 }]}>{shop.phone}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.title}>Daily Cash Book</Text>
            <Text style={[s.muted, { fontSize: 8, marginTop: 3 }]}>{dateLabel(report.date)}</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={[s.row, { backgroundColor: SOFT, borderBottomWidth: 0.5, borderBottomColor: LINE }]}>
          <Text style={[s.th, { width: W.no }]}>#</Text>
          <Text style={[s.th, { width: W.label }]}>Account</Text>
          <Text style={[s.th, { width: W.debit, textAlign: "right" }]}>Debit (₹)</Text>
          <Text style={[s.th, { width: W.credit, textAlign: "right" }]}>Credit (₹)</Text>
        </View>

        {/* Opening balance */}
        <View style={[s.row, { borderBottomWidth: 0.5, borderBottomColor: LINE, backgroundColor: SOFT }]}>
          <Text style={[s.td, s.bold, { width: W.no }]}>1</Text>
          <Text style={[s.td, s.bold, { width: W.label }]}>Opening balance</Text>
          <Text style={[s.td, s.bold, { width: W.debit, textAlign: "right" }]}>—</Text>
          <Text style={[s.td, s.bold, s.good, { width: W.credit, textAlign: "right" }]}>{money(report.opening)}</Text>
        </View>

        {/* Sections */}
        {sections.map((section) => (
          <View key={section}>
            <View style={[s.row, { borderBottomWidth: 0.5, borderBottomColor: LINE }]}>
              <Text style={[s.section, { width: "100%" }]}>{section}</Text>
            </View>
            {report.rows.filter((r) => r.section === section).map((r) => (
              <View key={r.no} style={[s.row, { borderBottomWidth: 0.5, borderBottomColor: LINE }]}>
                <Text style={[s.td, { width: W.no, color: MUTED }]}>{r.no + 1}</Text>
                <Text style={[s.td, { width: W.label }]}>{r.label}</Text>
                <Text style={[s.td, { width: W.debit, textAlign: "right", color: r.debit ? BAD : MUTED }]}>{r.debit ? money(r.debit) : "—"}</Text>
                <Text style={[s.td, { width: W.credit, textAlign: "right", color: r.credit ? GOOD : MUTED }]}>{r.credit ? money(r.credit) : "—"}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Closing balance */}
        <View style={[s.row, { borderBottomWidth: 0.5, borderBottomColor: LINE, backgroundColor: SOFT }]}>
          <Text style={[s.td, s.bold, { width: W.no }]}></Text>
          <Text style={[s.td, s.bold, { width: W.label }]}>Closing balance</Text>
          <Text style={[s.td, s.bold, s.bad, { width: W.debit, textAlign: "right" }]}>{money(report.closing)}</Text>
          <Text style={[s.td, s.bold, { width: W.credit, textAlign: "right", color: MUTED }]}>—</Text>
        </View>

        {/* Grand total */}
        <View style={s.totalRow}>
          <Text style={[s.td, s.bold, { width: W.no }]}></Text>
          <Text style={[s.td, s.bold, { width: W.label, fontSize: 10 }]}>Total</Text>
          <Text style={[s.td, s.bold, { width: W.debit, textAlign: "right", fontSize: 10 }]}>{money(grandTotal)}</Text>
          <Text style={[s.td, s.bold, { width: W.credit, textAlign: "right", fontSize: 10 }]}>{money(grandTotal)}</Text>
        </View>

        {/* Footer */}
        <Text style={[s.muted, { fontSize: 7, textAlign: "center", position: "absolute", bottom: 20, left: 36, right: 36 }]}>
          Generated by Pistonpad · {new Date().toLocaleString("en-IN")}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderDailyPdf(date: string, branchId: number): Promise<Buffer | null> {
  const [report, [shop]] = await Promise.all([
    getDailyReport(date, branchId),
    sql<{ shop_name: string; address: string; phone: string }[]>`select shop_name, address, phone from settings where id = 1`,
  ]);
  if (!shop) return null;
  const buf = await renderToBuffer(<DailyPdfDoc report={report} shop={shop} />);
  return buf as unknown as Buffer;
}
