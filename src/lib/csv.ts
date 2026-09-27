/**
 * Streaming CSV parser (RFC 4180: quotes, escaped quotes, commas and newlines inside quotes).
 * Feed it text chunks; it calls onRow for each complete record.
 */
export class CsvParser {
  private field = "";
  private row: string[] = [];
  private inQuotes = false;
  private quotePending = false;

  constructor(private onRow: (row: string[]) => void) {}

  push(chunk: string) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (this.quotePending) {
        this.quotePending = false;
        if (c === '"') { this.field += '"'; continue; }
        this.inQuotes = false;
      }
      if (this.inQuotes) {
        if (c === '"') this.quotePending = true;
        else this.field += c;
        continue;
      }
      if (c === '"' && this.field === "") this.inQuotes = true;
      else if (c === ",") { this.row.push(this.field); this.field = ""; }
      else if (c === "\n") this.endRow();
      else if (c !== "\r") this.field += c;
    }
  }

  end() {
    if (this.quotePending) { this.quotePending = false; this.inQuotes = false; }
    if (this.field !== "" || this.row.length) this.endRow();
  }

  private endRow() {
    this.row.push(this.field);
    this.field = "";
    const r = this.row;
    this.row = [];
    if (r.length === 1 && r[0].trim() === "") return;
    this.onRow(r);
  }
}
