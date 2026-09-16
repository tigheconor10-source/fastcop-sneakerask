"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadLabelButton({ saleId }: { saleId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/admin/sales/${saleId}/label`, {
      method: "PATCH",
      body: formData,
    });

    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error ?? "Upload error");
      return;
    }

    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Upload label"}
      </button>
      {error && <span className="text-xs text-status-rejected">{error}</span>}
    </div>
  );
}
