import { IMPORT_TEMPLATE } from "@/lib/importer";

export function GET() {
  return new Response("﻿" + IMPORT_TEMPLATE, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="spares-import-template.csv"' },
  });
}
