import "server-only";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { sql } from "../db";
import { GST_STATES } from "../format";
import { rupeesInWords } from "../words";
import { NOTO_400, NOTO_700, NOTO_DEVA_400, NOTO_DEVA_700 } from "./fonts.generated";

// Noto Sans for text; the Devanagari face supplies the ₹ sign as a fallback.
const woff = (b64: string) => `data:font/woff;base64,${b64}`;
Font.register({ family: "Noto", fonts: [{ src: woff(NOTO_400) }, { src: woff(NOTO_700), fontWeight: 700 }] });
Font.register({ family: "NotoDeva", fonts: [{ src: woff(NOTO_DEVA_400) }, { src: woff(NOTO_DEVA_700), fontWeight: 700 }] });
Font.registerHyphenationCallback((w) => [w]);

const INK = "#0f1a17", MUTED = "#5b6b66", LINE = "#d5ddd9", PRIMARY = "#0b6e4f", SOFT = "#f2f6f4", BAD = "#c0362c";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontFamily: ["Noto", "NotoDeva"] as unknown as string, fontSize: 9, color: INK },
  row: { flexDirection: "row" },
  header: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: INK },
  shopName: { fontSize: 17, fontWeight: 700 },
  muted: { color: MUTED },
  label: { fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 0.8, textTransform: "uppercase" },
  th: { fontSize: 7.5, fontWeight: 700, color: MUTED, textTransform: "uppercase" },
  cell: { paddingVertical: 5, paddingHorizontal: 4 },
  right: { textAlign: "right" },
  bold: { fontWeight: 700 },
});

// Column widths for the items table (must add up to 100%).
const COLS = [
  { key: "n", w: "4%" }, { key: "part", w: "34%" }, { key: "hsn", w: "8%" }, { key: "qty", w: "8%", right: true },
  { key: "rate", w: "11%", right: true }, { key: "disc", w: "6%", right: true }, { key: "taxable", w: "12%", right: true },
  { key: "gst", w: "5%", right: true }, { key: "amount", w: "12%", right: true },
] as const;

const money = (n: number) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

type Inv = {
  id: number; invoice_no: string; invoice_date: string; created_at: Date; status: string; payment_mode: string;
  customer_name: string; customer_phone: string; customer_gstin: string; customer_address: string | null;
  is_interstate: boolean; subtotal: number; discount: number; taxable: number; cgst: number; sgst: number; igst: number;
  round_off: number; total: number; amount_paid: number; notes: string;
};
type Item = { id: number; name: string; sku: string; hsn: string; qty: number; unit: string; rate: number; discount_pct: number; taxable: number; gst_rate: number; tax: number; total: number };
type Shop = { shop_name: string; address: string; phone: string; email: string; gstin: string; state_code: string; invoice_footer: string; logo: Buffer | null; logo_type: string | null };

export async function loadInvoiceForPdf(id: number) {
  const [[inv], items, [shop]] = await Promise.all([
    sql<Inv[]>`select i.*, to_char(i.invoice_date, 'YYYY-MM-DD') as invoice_date, c.address as customer_address
               from invoices i left join customers c on c.id = i.customer_id where i.id = ${id}`,
    sql<Item[]>`select * from invoice_items where invoice_id = ${id} order by id`,
    sql<Shop[]>`select shop_name, address, phone, email, gstin, state_code, invoice_footer, logo, logo_type from settings where id = 1`,
  ]);
  return inv ? { inv, items, shop } : null;
}

function InvoiceDoc({ inv, items, shop }: { inv: Inv; items: Item[]; shop: Shop }) {
  const due = Math.max(0, inv.total - inv.amount_paid);
  const cancelled = inv.status === "cancelled";
  // react-pdf can embed PNG and JPEG logos only.
  const logo = shop.logo && (shop.logo_type === "image/png" || shop.logo_type === "image/jpeg")
    ? { data: Buffer.from(shop.logo), format: shop.logo_type === "image/png" ? "png" as const : "jpg" as const } : null;
  const hsn = new Map<string, { hsn: string; rate: number; taxable: number; tax: number }>();
  for (const it of items) {
    const k = `${it.hsn}|${it.gst_rate}`;
    const h = hsn.get(k) ?? { hsn: it.hsn, rate: it.gst_rate, taxable: 0, tax: 0 };
    h.taxable += it.taxable; h.tax += it.tax;
    hsn.set(k, h);
  }
  const place = GST_STATES[inv.customer_gstin?.slice(0, 2) || shop.state_code] ?? "";
  const totals: [string, string, boolean?][] = [
    ["Subtotal", money(inv.subtotal)],
    ...(inv.discount ? [["Discount", `− ${money(inv.discount)}`] as [string, string]] : []),
    ["Taxable value", money(inv.taxable)],
    ...(inv.is_interstate ? [["IGST", money(inv.igst)] as [string, string]] : [["CGST", money(inv.cgst)], ["SGST", money(inv.sgst)]] as [string, string][]),
    ["Round off", money(inv.round_off)],
  ];

  return (
    <Document title={`Invoice ${inv.invoice_no}`} author={shop.shop_name} creator="Pistonpad">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={[s.row, { gap: 12, maxWidth: "62%" }]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
            {logo ? <Image src={logo} style={{ width: 58, height: 58, borderRadius: 29 }} /> : null}
            <View style={{ flexShrink: 1 }}>
              <Text style={s.shopName}>{shop.shop_name}</Text>
              {shop.address ? <Text style={[s.muted, { marginTop: 3 }]}>{shop.address}</Text> : null}
              <Text style={s.muted}>{[shop.phone && `Ph: ${shop.phone}`, shop.email].filter(Boolean).join("  ·  ")}</Text>
              {shop.gstin ? <Text style={{ marginTop: 2 }}>GSTIN: {shop.gstin}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.label, { color: PRIMARY, fontSize: 9 }]}>Tax invoice</Text>
            <Text style={{ fontSize: 12, fontWeight: 700, marginTop: 3 }}>{inv.invoice_no}</Text>
            <Text style={s.muted}>{dateLabel(inv.invoice_date)}</Text>
            {cancelled ? <Text style={{ color: BAD, fontWeight: 700, marginTop: 4 }}>CANCELLED</Text> : null}
          </View>
        </View>

        {/* Parties */}
        <View style={[s.row, { justifyContent: "space-between", paddingVertical: 12 }]}>
          <View style={{ maxWidth: "55%" }}>
            <Text style={s.label}>Bill to</Text>
            <Text style={[s.bold, { marginTop: 3, fontSize: 10 }]}>{inv.customer_name}</Text>
            {inv.customer_address ? <Text style={s.muted}>{inv.customer_address}</Text> : null}
            {inv.customer_phone ? <Text style={s.muted}>{inv.customer_phone}</Text> : null}
            {inv.customer_gstin ? <Text>GSTIN: {inv.customer_gstin}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.label}>Place of supply</Text>
            <Text style={{ marginTop: 3 }}>{place}{inv.is_interstate ? " (inter-state, IGST)" : ""}</Text>
            <Text style={[s.muted, { marginTop: 3 }]}>Payment: {inv.payment_mode}</Text>
          </View>
        </View>

        {/* Items — the heading repeats only on pages the table continues onto */}
        <View>
        <View style={[s.row, { backgroundColor: SOFT, borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE }]} fixed>
          {["#", "Part", "HSN", "Qty", "Rate", "Disc", "Taxable", "GST", "Amount"].map((h, i) => (
            <Text key={h} style={[s.cell, s.th, { width: COLS[i].w }, "right" in COLS[i] ? s.right : {}]}>{h}</Text>
          ))}
        </View>
        {items.map((it, n) => (
          <View key={it.id} style={[s.row, { borderBottomWidth: 0.5, borderColor: LINE }]} wrap={false}>
            <Text style={[s.cell, { width: COLS[0].w, color: MUTED }]}>{n + 1}</Text>
            <View style={[s.cell, { width: COLS[1].w }]}>
              <Text style={s.bold}>{it.name}</Text>
              <Text style={[s.muted, { fontSize: 7.5 }]}>{it.sku}</Text>
            </View>
            <Text style={[s.cell, { width: COLS[2].w }]}>{it.hsn}</Text>
            <Text style={[s.cell, s.right, { width: COLS[3].w }]}>{it.qty} {it.unit}</Text>
            <Text style={[s.cell, s.right, { width: COLS[4].w }]}>{money(it.rate)}</Text>
            <Text style={[s.cell, s.right, { width: COLS[5].w }]}>{it.discount_pct ? `${it.discount_pct}%` : "—"}</Text>
            <Text style={[s.cell, s.right, { width: COLS[6].w }]}>{money(it.taxable)}</Text>
            <Text style={[s.cell, s.right, { width: COLS[7].w }]}>{it.gst_rate}%</Text>
            <Text style={[s.cell, s.right, s.bold, { width: COLS[8].w }]}>{money(it.total)}</Text>
          </View>
        ))}
        </View>

        {/* Words + HSN summary | totals */}
        <View style={[s.row, { justifyContent: "space-between", marginTop: 14, gap: 24 }]} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Amount in words</Text>
            <Text style={[s.bold, { marginTop: 3 }]}>{rupeesInWords(inv.total)}</Text>
            <View style={{ marginTop: 12 }}>
              <View style={[s.row, { borderBottomWidth: 0.5, borderColor: LINE, paddingBottom: 3 }]}>
                <Text style={[s.th, { width: "25%" }]}>HSN</Text>
                <Text style={[s.th, s.right, { width: "30%" }]}>Taxable</Text>
                <Text style={[s.th, s.right, { width: "15%" }]}>Rate</Text>
                <Text style={[s.th, s.right, { width: "30%" }]}>{inv.is_interstate ? "IGST" : "CGST + SGST"}</Text>
              </View>
              {[...hsn.values()].map((h) => (
                <View key={h.hsn + h.rate} style={[s.row, { paddingVertical: 2 }]}>
                  <Text style={{ width: "25%" }}>{h.hsn}</Text>
                  <Text style={[s.right, { width: "30%" }]}>{money(h.taxable)}</Text>
                  <Text style={[s.right, { width: "15%" }]}>{h.rate}%</Text>
                  <Text style={[s.right, { width: "30%" }]}>{money(h.tax)}</Text>
                </View>
              ))}
            </View>
            {inv.notes ? <Text style={[s.muted, { marginTop: 10 }]}>Note: {inv.notes}</Text> : null}
          </View>
          <View style={{ width: 190 }}>
            {totals.map(([k, v]) => (
              <View key={k} style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
                <Text style={s.muted}>{k}</Text><Text>{v}</Text>
              </View>
            ))}
            <View style={[s.row, { justifyContent: "space-between", borderTopWidth: 2, borderColor: INK, marginTop: 4, paddingTop: 5 }]}>
              <Text style={[s.bold, { fontSize: 12 }]}>Total</Text><Text style={[s.bold, { fontSize: 12 }]}>{money(inv.total)}</Text>
            </View>
            <View style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
              <Text style={s.muted}>Paid</Text><Text>{money(inv.amount_paid)}</Text>
            </View>
            {due > 0 && !cancelled ? (
              <View style={[s.row, { justifyContent: "space-between", paddingVertical: 2 }]}>
                <Text style={[s.bold, { color: BAD }]}>Balance due</Text><Text style={[s.bold, { color: BAD }]}>{money(due)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Footer */}
        <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-end", marginTop: 28, paddingTop: 10, borderTopWidth: 0.5, borderColor: LINE }]} wrap={false}>
          <Text style={[s.muted, { maxWidth: "55%", fontSize: 8 }]}>{shop.invoice_footer}</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 8 }}>For {shop.shop_name}</Text>
            <Text style={[s.muted, { fontSize: 8, marginTop: 26 }]}>Authorised signatory</Text>
          </View>
        </View>
        <Text style={{ position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7, color: MUTED, textAlign: "center" }}
          render={({ pageNumber, totalPages }) => (totalPages > 1 ? `${inv.invoice_no} · Page ${pageNumber} of ${totalPages}` : "")} fixed />
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(id: number) {
  const data = await loadInvoiceForPdf(id);
  if (!data) return null;
  const buf = await renderToBuffer(<InvoiceDoc {...data} />);
  return { buf, invoiceNo: data.inv.invoice_no };
}
