"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemoveListingButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const remove = async () => {
    setLoading(true);
    const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    setLoading(false);
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-muted">Sure?</span>
        <button
          type="button"
          onClick={remove}
          disabled={loading}
          className="text-[11px] font-medium text-[var(--status-rejected)] underline disabled:opacity-50"
        >
          {loading ? "…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-[11px] text-muted underline"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Remove listing"
      title="Remove listing"
      className="btn btn-ghost btn-sm p-1.5 text-faint hover:text-[var(--status-rejected)]"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}
