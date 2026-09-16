"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderRowActions({
  saleId,
  salePrice,
}: {
  saleId: string;
  salePrice: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [value, setValue] = useState(salePrice.toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveEdit = async () => {
    const newPrice = Number(value);
    if (!newPrice || newPrice <= 0) {
      setError("Invalid price");
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/admin/sales/${saleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salePrice: newPrice }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }

    setEditing(false);
    router.refresh();
  };

  const confirmDelete = async () => {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/admin/sales/${saleId}`, { method: "DELETE" });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }

    router.refresh();
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-hover px-2 py-1">
          <span className="text-xs text-muted">€</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 bg-transparent text-sm font-semibold tabular-nums outline-none"
            autoFocus
          />
        </div>
        <button
          onClick={saveEdit}
          disabled={saving}
          className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
        <button
          onClick={() => { setEditing(false); setValue(salePrice.toFixed(2)); setError(null); }}
          className="text-xs text-muted underline"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-status-rejected">{error}</span>}
      </div>
    );
  }

  if (confirmingDelete) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted">Delete this order?</span>
        <button
          onClick={confirmDelete}
          disabled={saving}
          className="rounded-md bg-status-rejected px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? "…" : "Confirm"}
        </button>
        <button onClick={() => setConfirmingDelete(false)} className="text-xs text-muted underline">
          Cancel
        </button>
        {error && <span className="text-xs text-status-rejected">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-muted underline transition hover:text-accent"
      >
        Edit
      </button>
      <button
        onClick={() => setConfirmingDelete(true)}
        className="text-xs text-muted underline transition hover:text-status-rejected"
      >
        Delete
      </button>
    </div>
  );
}
