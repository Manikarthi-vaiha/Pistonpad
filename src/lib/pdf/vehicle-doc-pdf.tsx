import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { buildDocModel, loadVehicleDoc, type DocModel, type DocParty } from "../vehicle-docs";
import { PDF_FONT } from "./fonts";

const INK = "#0f1a17", MUTED = "#5b6b66", LINE = "#d5ddd9", PRIMARY = "#0b6e4f", SOFT = "#f2f6f4", BAD = "#c0362c";

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 44, paddingHorizontal: 36, fontFamily: PDF_FONT, fontSize: 9, color: INK },
  row: { flexDirection: "row" },
  muted: { color: MUTED },
  bold: { fontWeight: 700 },
  label: { fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 0.8, textTransform: "uppercase" },
  box: { borderWidth: 0.75, borderColor: LINE, borderRadius: 4, padding: 9 },
  section: { marginTop: 12 },
});

function Party({ p }: { p: DocParty }) {
  return (
    <View style={[s.box, { flex: 1 }]}>
      <Text style={s.label}>{p.role}</Text>
      <Text style={[s.bold, { fontSize: 10.5, marginTop: 3 }]}>{p.name}</Text>
      {p.lines.map((l) => <Text key={l} style={[s.muted, { marginTop: 1.5 }]}>{l}</Text>)}
    </View>
  );
}

function BikeDocPdf({ m, logo }: { m: DocModel; logo: { data: Buffer; format: "png" | "jpg" } | null }) {
  return (
    <Document title={`${m.title} ${m.no}`} author={m.shop.name} creator="Pistonpad">
      <Page size="A4" style={s.page}>
        {/* Header: shop and document number */}
        <View style={[s.row, { justifyContent: "space-between", paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: INK }]}>
          <View style={[s.row, { gap: 10, maxWidth: "62%" }]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
            {logo ? <Image src={logo} style={{ width: 50, height: 50, borderRadius: 25 }} /> : null}
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: 700 }}>{m.shop.name}</Text>
              {m.shop.address ? <Text style={[s.muted, { marginTop: 2 }]}>{m.shop.address}</Text> : null}
              {m.shop.contact ? <Text style={s.muted}>{m.shop.contact}</Text> : null}
              {m.shop.gstin ? <Text style={{ marginTop: 1 }}>GSTIN: {m.shop.gstin}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.label, { color: PRIMARY, fontSize: 9 }]}>{m.title}</Text>
            <Text style={{ fontSize: 12, fontWeight: 700, marginTop: 3 }}>{m.no}</Text>
            <Text style={s.muted}>{m.date}</Text>
            {m.cancelled ? <Text style={{ color: BAD, fontWeight: 700, marginTop: 4 }}>CANCELLED{m.cancelReason ? `: ${m.cancelReason}` : ""}</Text> : null}
          </View>
        </View>

        {/* Seller and buyer */}
        <View style={[s.row, s.section, { gap: 10 }]}>
          <Party p={m.seller} />
          <Party p={m.buyer} />
        </View>

        {/* Vehicle */}
        <View style={[s.box, s.section]} wrap={false}>
          <View style={[s.row, { justifyContent: "space-between", alignItems: "center" }]}>
            <Text style={s.label}>Vehicle</Text>
            <View style={{ borderWidth: 1.5, borderColor: INK, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 8 }}>
              <Text style={{ fontWeight: 700, fontSize: 11, letterSpacing: 1.2 }}>{m.plate}</Text>
            </View>
          </View>
          <View style={[s.row, { flexWrap: "wrap", marginTop: 6 }]}>
            {m.vehicle.map(([k, v]) => (
              <View key={k} style={{ width: "50%", paddingVertical: 3, paddingRight: 8 }}>
                <Text style={[s.muted, { fontSize: 7.5 }]}>{k}</Text>
                <Text style={s.bold}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Money and handover */}
        <View style={[s.row, s.section, { gap: 10 }]} wrap={false}>
          <View style={[s.box, { flex: 1.4 }]}>
            <Text style={s.label}>Payment</Text>
            {m.money.map(([k, v]) => (
              <View key={k} style={[s.row, { justifyContent: "space-between", gap: 10, marginTop: 4 }]}>
                <Text style={[s.muted, { flex: 1 }]}>{k}</Text><Text>{v}</Text>
              </View>
            ))}
            <View style={[s.row, { justifyContent: "space-between", borderTopWidth: 1.5, borderColor: INK, marginTop: 6, paddingTop: 5 }]}>
              <Text style={[s.bold, { fontSize: 11 }]}>{m.total[0]}</Text><Text style={[s.bold, { fontSize: 11 }]}>{m.total[1]}</Text>
            </View>
            <Text style={[s.muted, { marginTop: 4, fontSize: 8 }]}>{m.words}</Text>
          </View>
          <View style={[s.box, { flex: 1, backgroundColor: SOFT }]}>
            <Text style={s.label}>{m.handover[0]}</Text>
            <Text style={[s.bold, { fontSize: 11, marginTop: 3 }]}>{m.handover[1]}</Text>
            <Text style={[s.label, { marginTop: 10 }]}>{m.papers.title}</Text>
            {m.papers.items.length
              ? m.papers.items.map((p) => <Text key={p} style={{ marginTop: 2 }}>•  {p}</Text>) // the embedded Latin font has no ✓
              : <Text style={[s.muted, { marginTop: 2 }]}>None recorded</Text>}
          </View>
        </View>

        {m.notes ? <Text style={[s.section, s.muted]}>Note: {m.notes}</Text> : null}

        {/* Terms / declaration */}
        <View style={s.section} wrap={false}>
          <Text style={s.label}>{m.terms.title}</Text>
          {m.terms.items.map((t, i) => (
            <View key={i} style={[s.row, { marginTop: 3, gap: 4 }]}>
              <Text style={s.muted}>{i + 1}.</Text><Text style={[s.muted, { flex: 1 }]}>{t}</Text>
            </View>
          ))}
        </View>

        {/* Signatures */}
        <View style={[s.row, { justifyContent: "space-between", marginTop: 34, gap: 40 }]} wrap={false}>
          {m.signatures.map((g) => (
            <View key={g.label} style={{ flex: 1, borderTopWidth: 0.75, borderColor: INK, paddingTop: 4 }}>
              <Text style={s.bold}>{g.label}</Text>
              <Text style={s.muted}>{g.name}</Text>
            </View>
          ))}
        </View>

        <Text style={{ position: "absolute", bottom: 18, left: 36, right: 36, fontSize: 7, color: MUTED, textAlign: "center" }}
          render={({ pageNumber, totalPages }) => `${m.no}${totalPages > 1 ? ` · Page ${pageNumber} of ${totalPages}` : ""}`} fixed />
      </Page>
    </Document>
  );
}

export async function renderVehicleDocPdf(id: number) {
  const data = await loadVehicleDoc(id);
  if (!data) return null;
  const { shop } = data;
  // react-pdf can embed PNG and JPEG logos only.
  const logo = shop.logo && (shop.logo_type === "image/png" || shop.logo_type === "image/jpeg")
    ? { data: Buffer.from(shop.logo), format: shop.logo_type === "image/png" ? "png" as const : "jpg" as const } : null;
  const m = buildDocModel(data.doc, shop);
  const buf = await renderToBuffer(<BikeDocPdf m={m} logo={logo} />);
  return { buf, docNo: m.no };
}
