"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { Button, buttonClass, Card, cx, Notice } from "@/components/ui";
import { count } from "@/lib/format";

type Stats = { rows: number; inserted: number; updated: number; skipped: number; errors: string[] };

export function ImportClient() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Stats | null>(null);
  const [done, setDone] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  const choose = (f: File | undefined | null) => {
    setDone(null); setError(""); setProgress(null);
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) { setError("Choose a .csv file. In Excel: File → Save As → CSV (Comma delimited)."); return; }
    if (f.size > 4 * 1024 * 1024) setError("This file is over 4 MB. Online hosting (Vercel) rejects uploads that big — split it into smaller files, or use the command-line importer (npm run import).");
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true); setError(""); setDone(null);
    try {
      const res = await fetch("/api/import", { method: "POST", body: file, headers: { "Content-Type": "text/csv" } });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed.");
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { done: end, value } = await reader.read();
        if (end) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) {
          if (!l) continue;
          const m = JSON.parse(l);
          if (m.progress) setProgress(m.progress);
          if (m.done) setDone(m.done);
          if (m.error) setError(m.error);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files[0]); }}
        onClick={() => input.current?.click()}
        className={cx("flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
          drag ? "border-primary bg-primary-soft" : "border-line-2 hover:border-ink-3 hover:bg-surface-2")}
      >
        {file ? <FileSpreadsheet className="h-10 w-10 text-primary" /> : <UploadCloud className="h-10 w-10 text-ink-3" />}
        {file ? (
          <div><p className="font-semibold">{file.name}</p><p className="text-sm text-ink-3">{(file.size / 1024 / 1024).toFixed(1)} MB · click to choose another</p></div>
        ) : (
          <div><p className="font-semibold">Drop your CSV file here, or click to choose</p><p className="text-sm text-ink-3">Up to 4 MB per file (about 30,000 rows)</p></div>
        )}
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <a href="/api/import/template" className={buttonClass("ghost")}><Download className="h-4 w-4" /> Download template</a>
        <Button variant="primary" size="lg" onClick={upload} disabled={!file || busy}>{busy ? "Importing…" : "Import parts"}</Button>
      </div>

      {busy || progress ? (
        <div className="mt-5 rounded-lg bg-surface-2 p-4 text-sm">
          <p className="font-medium">{busy ? "Importing…" : "Finished"} {count(progress?.rows ?? 0)} rows read</p>
          <p className="text-ink-2">{count(progress?.inserted ?? 0)} new · {count(progress?.updated ?? 0)} updated · {count(progress?.skipped ?? 0)} skipped</p>
        </div>
      ) : null}
      {done ? (
        <div className="mt-4 flex flex-col gap-2">
          <Notice tone="good">Import complete: {count(done.inserted)} parts added and {count(done.updated)} updated{done.skipped ? `, ${count(done.skipped)} rows skipped` : ""}.</Notice>
          {done.errors.length ? <ul className="list-disc pl-5 text-sm text-ink-2">{done.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
        </div>
      ) : null}
      {error ? <div className="mt-4"><Notice tone="bad">{error}</Notice></div> : null}
    </Card>
  );
}
