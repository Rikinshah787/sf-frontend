"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ImagePlus } from "lucide-react";
import Button from "@/components/ui/Button";

/** Client-side cap on the picked file itself (the base64 form grows ~4/3). */
export const MAX_PHOTO_BYTES = 1024 * 1024;

/**
 * One allowlist for both the file picker and the drag-and-drop path, so a
 * dropped file follows exactly the rules the picker advertises. Bitmap
 * formats only — SVG stays out because it is scriptable.
 */
const ACCEPTED_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",
];
const ACCEPT = ACCEPTED_TYPES.join(",");

/** "438 KB"-style size for the picked-file summary. */
function formatSize(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Photo picker for the contact form. The chosen image is read into a base64
 * `data:image/...` URL and submitted through a hidden input, so the form stays
 * a plain POST and the server action never handles file uploads.
 *
 * The preview doubles as a drop zone (click or drag and drop); the buttons
 * remain for keyboard and mobile users.
 */
export default function PhotoInput({
  id,
  name,
  defaultValue,
  errorId,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  errorId?: string;
}) {
  const [photo, setPhoto] = useState(defaultValue ?? "");
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [reading, setReading] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Monotonic token: only the latest pick (or Remove) may commit its result,
  // so a slow FileReader can never overwrite a newer choice.
  const pickToken = useRef(0);

  function readFile(picked: File) {
    setRemoved(false);

    if (!ACCEPTED_TYPES.includes(picked.type)) {
      setPickError("Choose a PNG, JPEG, WebP or BMP image — other formats aren't supported.");
      return;
    }
    if (picked.size > MAX_PHOTO_BYTES) {
      setPickError(`${picked.name} is ${formatSize(picked.size)} — pick one under 1 MB.`);
      return;
    }

    const token = ++pickToken.current;
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (token !== pickToken.current) return; // stale read; a newer pick or Remove won
      setPhoto(String(reader.result));
      setFile({ name: picked.name, size: picked.size });
      setPickError(null);
      setReading(false);
    };
    reader.onerror = () => {
      if (token !== pickToken.current) return;
      setPickError("Could not read that file. Try again.");
      setReading(false);
    };
    reader.readAsDataURL(picked);
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again
    if (picked) readFile(picked);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped && !reading) readFile(dropped);
  }

  function removePhoto() {
    pickToken.current += 1; // invalidate any in-flight read
    setPhoto("");
    setFile(null);
    setReading(false);
    setRemoved(true);
  }

  const summary = file
    ? `${file.name} · ${formatSize(file.size)}`
    : photo
      ? "Current photo"
      : "Click to upload or drag and drop";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
      <input type="hidden" name={name} value={photo} />

      <button
        type="button"
        disabled={reading}
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        aria-describedby={errorId}
        className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-left transition-colors hover:border-primary/60 hover:bg-secondary/30 disabled:pointer-events-none disabled:opacity-60 sm:w-80"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- base64 data URL; next/image adds nothing here
          <img
            src={photo}
            alt="Current contact photo"
            className="h-14 w-14 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"
          >
            <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-foreground">
            {summary}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            PNG, JPEG, WebP or BMP up to 1 MB. No photo shows initials instead.
          </span>
        </span>
      </button>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={reading}
            onClick={() => fileRef.current?.click()}
          >
            {reading ? "Preparing photo…" : photo ? "Change photo" : "Upload photo"}
          </Button>
          {photo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={reading}
              onClick={removePhoto}
            >
              Remove
            </Button>
          ) : null}
        </div>
        {/* One polite live region: reading progress and removal confirmations. */}
        <p aria-live="polite" className="text-[11px] text-muted-foreground">
          {reading ? "Preparing photo…" : removed ? "Photo removed." : ""}
        </p>
        {pickError ? (
          <p role="alert" className="text-[13px] text-destructive">
            {pickError}
          </p>
        ) : null}
      </div>

      <input
        ref={fileRef}
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={onFile}
        aria-describedby={errorId}
      />
    </div>
  );
}
