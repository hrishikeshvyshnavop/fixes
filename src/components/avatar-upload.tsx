"use client";

import { useRef, useState, useTransition } from "react";
import { Camera } from "lucide-react";
import { removeAvatar, uploadAvatar } from "@/app/auth-actions";
import { Avatar } from "./feedback";
import { button } from "./styles";

const SIZE = 256; // stored photo is SIZE×SIZE

/** Center-crops to a square and resizes in the browser, so uploads stay small (~20–40 KB). */
async function toSquare(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const webp = canvas.toDataURL("image/webp", 0.86);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.86);
}

export function AvatarUpload({ name, src, uploaded }: { name: string; src: string | null; uploaded: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shown = preview ?? src;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    if (file.size > 15_000_000) return setError("That image is over 15 MB.");
    startTransition(async () => {
      try {
        const dataUrl = await toSquare(file);
        setPreview(dataUrl);
        const res = await uploadAvatar(dataUrl);
        if (res.error) {
          setPreview(null);
          setError(res.error);
        }
      } catch {
        setPreview(null);
        setError("Couldn't read that image. Try a JPEG or PNG.");
      }
    });
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        className="group relative shrink-0 rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label="Change profile photo"
        title="Change profile photo"
      >
        <Avatar name={name} src={shown} size={56} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Camera size={18} />
        </span>
      </button>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={pending} className={button.outline}>
            {pending ? "Uploading…" : shown ? "Change photo" : "Upload photo"}
          </button>
          {uploaded && !pending && (
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  setPreview(null);
                  await removeAvatar();
                })
              }
              className={button.danger}
            >
              Remove
            </button>
          )}
        </div>
        <p className={`mt-1.5 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {error ?? "JPEG, PNG or WebP. It's cropped to a square."}
        </p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
