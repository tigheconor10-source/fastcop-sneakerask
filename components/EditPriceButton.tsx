"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { maxPayoutForSellingPrice } from "@/lib/pricing";

export default function EditPriceButton({
  productId,
  currentPrice,
  originalPrice,
  competitorSellingPrice,
  isBestPrice,
}: {
  productId: string;
  currentPrice: number;
  originalPrice?: number | null;
  competitorSellingPrice?: number;
  isBestPrice?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [value, setValue] = useState(currentPrice.toFixed(0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const maxPayout = originalPrice != null ? maxPayoutForSellingPrice(originalPrice) : null;

  const payoutToBeBest = (() => {
    if (!competitorSellingPrice || isBestPrice) return null;
    const p = maxPayoutForSellingPrice(competitorSellingPrice - 1);
    if (p === null || p <= 0) return null;
    if (maxPayout !== null && p > maxPayout) return maxPayout;
    return Math.floor(p);
  })();

  // Calcular posición del popover relativa al botón en la pantalla
  const openPopover = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY + 6,
      right: window.innerWidth - rect.right,
    });
    setValue(currentPrice.toFixed(0));
    setError(null);
    setOpen(true);
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      const popover = document.getElementById("edit-price-popover");
      if (popover?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const save = async () => {
    const payoutPrice = Number(value);
    if (!payoutPrice || payoutPrice <= 0) { setError("Enter a payout > €0"); return; }
    if (maxPayout !== null && payoutPrice > maxPayout) { setError(`Max €${maxPayout.toFixed(0)}`); return; }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/products/${productId}/price`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutPrice }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Error"); return; }
    setOpen(false);
    router.refresh();
  };

  const popover = open ? (
    <div
      id="edit-price-popover"
      style={{ position: "absolute", top: pos.top, right: pos.right, zIndex: 9999 }}
      className="w-52 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-md)]"
    >
      {payoutToBeBest !== null && (
        <button
          type="button"
          onClick={() => setValue(String(payoutToBeBest))}
          className="flex w-full items-center justify-between gap-2 rounded-md bg-accent-soft px-2.5 py-1.5 text-[11px] text-accent transition-colors hover:bg-accent-border/40 mb-2"
        >
          <span>Lower to beat others</span>
          <span className="font-semibold">€{payoutToBeBest}</span>
        </button>
      )}

      <label className="mb-1 block text-[11px] text-muted">Your payout (€)</label>
      <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 mb-2 ${
        Number(value) > (maxPayout ?? Infinity)
          ? "border-[var(--status-rejected)]"
          : "border-border-strong focus-within:border-accent"
      }`}>
        <span className="text-sm text-muted">€</span>
        <input
          type="number"
          min={0}
          max={maxPayout ?? undefined}
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="w-full bg-transparent text-sm font-semibold tabular-nums outline-none"
          autoFocus
        />
      </div>

      {maxPayout !== null && (
        <p className="mb-2 text-[10px] text-faint">Max payout: €{maxPayout.toFixed(0)}</p>
      )}
      {error && <p className="mb-2 text-[11px] text-[var(--status-rejected)]">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving || !value}
          className="flex-1 rounded-md bg-ink py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-muted underline">
          Cancel
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openPopover}
        className="text-xs text-muted underline transition hover:text-accent"
      >
        Edit price
      </button>
      {typeof document !== "undefined" && popover
        ? createPortal(popover, document.body)
        : null}
    </>
  );
}
