"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrackingNumberInput({ saleId, value }: { saleId: string; value: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/sales/${saleId}/tracking`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracking_number: draft }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Error saving tracking number");
      return;
    }
    setEditing(false);
    router.refresh();
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-left text-xs text-muted hover:text-accent transition"
      >
        {value ? (
          <span className="font-mono">📦 {value}</span>
        ) : (
          <span className="underline">+ Add tracking number</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="1Z999AA..."
        className="w-28 rounded-md border border-border bg-surface px-1.5 py-1 font-mono text-xs outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="text-xs font-medium text-accent disabled:opacity-50"
      >
        {saving ? "…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => { setEditing(false); setDraft(value ?? ""); setError(null); }}
        className="text-xs text-muted"
      >
        ✕
      </button>
      {error && <span className="text-xs text-status-rejected">{error}</span>}
    </div>
  );
}
