"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { Button, cx, Notice } from "@/components/ui";
import { PHOTO_KINDS } from "@/lib/regno";
import { deletePhoto, uploadPhoto } from "../actions";

type Photo = { id: number; kind: string; caption: string };
const src = (id: number, thumb = false) => `/api/vehicles/photos/${id}${thumb ? "?size=thumb" : ""}`;

/** Shrinks a phone photo to at most `max` px on the long side as JPEG; keeps EXIF rotation. */
async function shrink(file: File, max: number, quality: number) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("resize failed"))), "image/jpeg", quality));
}

async function send(vehicleId: number, file: File, kind: string) {
  const fd = new FormData();
  fd.set("photo", new File([await shrink(file, 1600, 0.82)], "photo.jpg", { type: "image/jpeg" }));
  fd.set("thumb", new File([await shrink(file, 360, 0.75)], "thumb.jpg", { type: "image/jpeg" }));
  fd.set("kind", kind);
  return uploadPhoto(vehicleId, fd);
}

/** Pick one or more photos (camera or gallery) and upload them one at a time with progress. */
function useUploader(vehicleId: number) {
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = async (files: FileList | null, kind: string) => {
    if (!files?.length) return;
    setError(null);
    const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, 20);
    for (let i = 0; i < list.length; i++) {
      setProgress(list.length > 1 ? `Uploading ${i + 1} of ${list.length}…` : "Uploading…");
      try {
        const r = await send(vehicleId, list[i], kind);
        if (r.error) { setError(r.error); break; }
      } catch {
        setError(`Couldn't read “${list[i].name}”. Try a JPG or PNG photo.`);
        break;
      }
    }
    setProgress(null);
  };
  return { progress, error, upload };
}

export function VehiclePhotos({ vehicleId, photos }: { vehicleId: number; photos: Photo[] }) {
  const gallery = photos.filter((p) => p.kind !== "owner");
  const [kind, setKind] = useState("vehicle");
  const [open, setOpen] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { progress, error, upload } = useUploader(vehicleId);
  const groups = (["vehicle", "damage", "document"] as const).map((k) => [k, gallery.filter((p) => p.kind === k)] as const).filter(([, l]) => l.length);

  return (
    <div className="p-5">
      {groups.length ? (
        <div className="flex flex-col gap-4">
          {groups.map(([k, list]) => (
            <div key={k}>
              <p className="mb-2 text-[11.5px] font-semibold tracking-wider text-ink-3 uppercase">{PHOTO_KINDS[k]} · {list.length}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {list.map((p) => (
                  <button key={p.id} type="button" onClick={() => setOpen(gallery.indexOf(p))}
                    className={cx("group relative aspect-[4/3] overflow-hidden rounded-lg border bg-surface-2", k === "damage" ? "border-bad/50" : "border-line")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src(p.id, true)} alt={p.caption || PHOTO_KINDS[k]} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line-2 px-4 py-8 text-sm text-ink-2 hover:border-primary hover:text-primary">
          <Camera className="h-7 w-7" /> Add photos of the bike: front, back, both sides, meter, and any damage
        </button>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line-2 p-0.5" role="radiogroup" aria-label="Photo type">
          {(["vehicle", "damage", "document"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
              className={cx("rounded-md px-3 py-1.5 text-[13px] font-semibold", kind === k ? (k === "damage" ? "bg-bad text-white" : "bg-primary text-primary-ink") : "text-ink-2 hover:bg-surface-2")}>
              {PHOTO_KINDS[k]}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" variant="primary" disabled={!!progress} onClick={() => input.current?.click()}>
          {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {progress ?? `Add ${PHOTO_KINDS[kind].toLowerCase()} photos`}
        </Button>
        <input ref={input} type="file" accept="image/*" multiple hidden
          onChange={(e) => { const files = e.target.files; upload(files, kind).then(() => { if (input.current) input.current.value = ""; }); }} />
      </div>
      {error ? <div className="mt-3"><Notice tone="bad">{error}</Notice></div> : null}
      {open != null && gallery[open] ? <Lightbox vehicleId={vehicleId} photos={gallery} index={open} onIndex={setOpen} /> : null}
    </div>
  );
}

function Lightbox({ vehicleId, photos, index, onIndex }: { vehicleId: number; photos: Photo[]; index: number; onIndex: (i: number | null) => void }) {
  const [pending, start] = useTransition();
  const p = photos[index];
  const go = (d: number) => onIndex((index + d + photos.length) % photos.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onIndex(null);
      if (e.key === "ArrowRight") onIndex((index + 1) % photos.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onIndex]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => onIndex(null)}>
      <div className="flex items-center justify-between gap-3 p-3 text-sm text-white" onClick={(e) => e.stopPropagation()}>
        <span>{PHOTO_KINDS[p.kind]} · {index + 1} of {photos.length}</span>
        <div className="flex gap-1">
          <button type="button" disabled={pending} aria-label="Delete photo" className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40"
            onClick={() => { if (confirm("Delete this photo?")) start(async () => { await deletePhoto(vehicleId, p.id); onIndex(photos.length > 1 ? Math.min(index, photos.length - 2) : null); }); }}>
            <Trash2 className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Close" className="rounded-lg p-2 hover:bg-white/10" onClick={() => onIndex(null)}><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src(p.id)} alt={p.caption || PHOTO_KINDS[p.kind]} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        {photos.length > 1 ? (
          <>
            <button type="button" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); go(-1); }}
              className="absolute left-3 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"><ChevronLeft className="h-6 w-6" /></button>
            <button type="button" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); go(1); }}
              className="absolute right-3 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"><ChevronRight className="h-6 w-6" /></button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Round owner photo; tap to add or change it. */
export function OwnerPhoto({ vehicleId, photoId, name }: { vehicleId: number; photoId: number | null; name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { progress, error, upload } = useUploader(vehicleId);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" onClick={() => input.current?.click()} disabled={!!progress} title={photoId ? "Change owner photo" : "Add owner photo"}
        className="group relative h-20 w-20 overflow-hidden rounded-full border-2 border-line-2 bg-surface-2 text-xl font-bold text-ink-3 hover:border-primary">
        {photoId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src(photoId, true)} alt={`${name || "Owner"} photo`} className="h-full w-full object-cover" />
        ) : <span>{initials}</span>}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
          {progress ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </span>
      </button>
      <span className="text-[11px] text-ink-3">{progress ?? (photoId ? "Change photo" : "Add photo")}</span>
      {error ? <span className="max-w-32 text-center text-[11px] text-bad">{error}</span> : null}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files, "owner").then(() => { if (input.current) input.current.value = ""; }); }} />
    </div>
  );
}
