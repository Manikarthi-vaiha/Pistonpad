import type { Metadata } from "next";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { IMPORT_COLUMNS } from "@/lib/importer";
import { ImportClient } from "./ImportClient";

export const metadata: Metadata = { title: "Import parts" };

const HELP: Record<string, string> = {
  sku: "Part number (required, unique)", name: "Part name (required)", brand: "Hero, Honda, TVS… or Universal",
  category: "Brakes, Engine…", models: "Bike models it fits, separated by |", hsn: "HSN code (default 8714)", unit: "pcs, set, pair, kit…",
  cost_price: "Your buying price from your supplier", showroom_cost: "Optional: price when bought from a showroom / outside market",
  sale_price: "Wholesale rate before GST", retail_price: "Optional: showroom rate for walk-in customers", mrp: "Optional", gst_rate: "0, 5, 12, 18 or 28",
  stock: "Quantity on hand. Leave empty to keep current stock", reorder_level: "Reorder alert level", rack: "Shelf / bin",
};

export default async function ImportPage() {
  await requireUser("owner");
  return (
    <>
      <PageHeader title="Import parts" sub="Add or update thousands of parts at once from Excel. Existing part numbers are updated, new ones are added." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ImportClient />
        <Card className="xl:self-start">
          <CardHeader title="File format" sub="Save your Excel sheet as CSV (Comma delimited). Missing brands, categories and models are created automatically." />
          <ul className="divide-y divide-line text-sm">
            {IMPORT_COLUMNS.map((c) => (
              <li key={c} className="flex gap-3 px-5 py-2"><code className="w-28 shrink-0 font-mono text-[12.5px] text-primary">{c}</code><span className="text-ink-2">{HELP[c]}</span></li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-3">
            Files with millions of rows import faster from the server: <code className="font-mono">npm run import -- parts.csv</code>
          </p>
        </Card>
      </div>
    </>
  );
}
