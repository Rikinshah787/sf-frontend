"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus } from "lucide-react";
import Button from "@/components/ui/Button";

/** Client-side cap on the picked file itself (the base64 form grows ~4/3). */
export const MAX_PHOTO_BYTES = 1024 * 1024;

/**
 * Photo picker for the contact form. The chosen image is read into a base64
 * `data:image/...` URL and submitted through a hidden input, so the form stays
 * a plain POST and the server action never handles file uploads.
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
  const [pickError, setPickError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Monotonic token: only the latest pick (or Remove) may commit its result,
  // so a slow FileReader can never overwrite a newer choice.
  const pickToken = useRef(0);

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again
    if (!file) return;

    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      // SVG is rejected by the API too: it is scriptable, so it is unsafe to
      // store and echo back as an <img> source.
      setPickError("Choose a bitmap image (PNG, JPEG, WebP…) — SVG isn't supported.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPickError("That image is over 1 MB — pick a smaller one.");
      return;
    }

    const token = ++pickToken.current;
    const reader = new FileReader();
    reader.onload = () => {
      if (token !== pickToken.current) return; // stale read; a newer pick or Remove won
      setPhoto(String(reader.result));
      setPickError(null);
    };
    reader.onerror = () => {
      if (token !== pickToken.current) return;
      setPickError("Could not read that file. Try again.");
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    pickToken.current += 1; // invalidate any in-flight read
    setPhoto("");
  }

  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name={name} value={photo} />

      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- base64 data URL; next/image adds nothing here
        <img
          src={photo}
          alt="Contact photo preview"
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

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            {photo ? "Change photo" : "Upload photo"}
          </Button>
          {photo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removePhoto}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Any image up to 1 MB. Contacts without a photo show their initials.
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
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="sr-only"
        onChange={onFile}
        aria-describedby={errorId}
      />
    </div>
  );
}
