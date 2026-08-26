"use client";

import { useState } from "react";
import Image from "next/image";

export default function ImageUpload({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground-muted">{label}</label>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        {url ? (
          <Image src={url} alt="" width={56} height={56} unoptimized className="rounded-md object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border-subtle text-[10px] text-foreground-muted">
            —
          </div>
        )}
        {/* SVG qəsdən yoxdur: server onu rədd edir (aktiv məzmun formatıdır və
            yüklənən fayllar saytın öz origin-indən verilir). Burada siyahıda
            saxlamaq adamın faylı seçib yalnız sonra xəta almasına səbəb olurdu —
            bax app/api/upload/route.ts. */}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleChange}
          className="text-sm text-foreground-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-border-subtle"
        />
        {uploading && <span className="text-xs text-foreground-muted">Yüklənir...</span>}
      </div>
      {error && <p className="mt-1 text-xs text-live">{error}</p>}
    </div>
  );
}
