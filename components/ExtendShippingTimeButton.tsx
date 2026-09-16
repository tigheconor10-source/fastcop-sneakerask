"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExtendShippingTimeButton({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("24");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const extraHours = Number(hours);
    if (!extraHours || extraHours <= 0) {
      setError("Invalid");
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/admin/sales/${saleId}/extend`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extraHours }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }

    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted underline transition hover:text-accent"
      >
        + Add shipping time
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        step="1"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-xs tabular-nums outline-none focus:border-accent"
        autoFocus
      />
      <span className="text-xs text-muted">hours</span>
      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
      >
        {saving ? "…" : "Add"}
      </button>
      <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-xs text-muted underline">
        Cancel
      </button>
      {error && <span className="text-xs text-status-rejected">{error}</span>}
    </div>
  );
}
