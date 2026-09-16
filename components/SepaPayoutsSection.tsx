"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LATE_SHIPPING_PENALTY } from "@/lib/lateFees";
import MarkPaidButton from "@/components/MarkPaidButton";

export type SepaPendingItem = {
  id: string;
  seller: string;
  iban: string | null;
  amount: number;
  orderRef: string;
  late: boolean;
};

export default function SepaPayoutsSection({ items }: { items: SepaPendingItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(items.map((i) => i.id)));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  };

  const total = useMemo(
    () =>
      items
        .filter((i) => selected.has(i.id))
        .reduce((s, i) => s + Math.max(i.amount - (i.late ? LATE_SHIPPING_PENALTY : 0), 0), 0),
    [items, selected]
  );

  const generate = async () => {
    setGenerating(true);
    setError(null);

    const res = await fetch("/api/admin/payouts/sepa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionIds: Array.from(selected) }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setGenerating(false);
      setError(data?.error ?? "Error generating SEPA file");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fastcop-sepa-${new Date().toISOString().slice(0, 10)}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setGenerating(false);
    setDownloaded(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/5 p-4">
        <div>
          <p className="text-sm text-muted">Selected total</p>
          <p className="text-2xl font-bold text-accent">€{total.toFixed(2)}</p>
          <p className="text-xs text-muted">{selected.size} of {items.length} selected</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
          >
            {selected.size === items.length ? "Deselect all" : "Select all"}
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={generating || selected.size === 0}
            className="btn btn-primary btn-sm"
          >
            {generating ? "Generating…" : "Generate SEPA file"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-status-rejected">{error}</p>
      )}

      {downloaded && (
        <div className="rounded-xl border border-status-pending/20 bg-status-pending/8 px-4 py-3 text-sm text-status-pending">
          XML descargado. Esto NO marca nada como pagado todavía — sube el
          fichero a tu banco y, una vez confirmadas las transferencias, marca
          cada una como "Mark paid" abajo (o desde Orders).
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const penalty = item.late ? LATE_SHIPPING_PENALTY : 0;
          const effective = Math.max(item.amount - penalty, 0);
          return (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-4 transition hover:bg-surface-hover"
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                className="h-4 w-4 accent-accent"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{item.seller}</p>
                <p className="font-mono text-xs text-muted truncate">
                  IBAN: {item.iban ?? "—"} · {item.orderRef}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">€{effective.toFixed(2)}</p>
                {item.late && (
                  <p className="text-xs text-status-rejected">−€{LATE_SHIPPING_PENALTY} late (was €{item.amount.toFixed(2)})</p>
                )}
                {!item.iban && (
                  <p className="text-xs text-status-rejected">No IBAN - won't be included</p>
                )}
              </div>
              <div onClick={(e) => e.preventDefault()}>
                <MarkPaidButton commissionId={item.id} />
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
