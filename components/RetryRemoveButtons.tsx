"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RetryRemoveButtons({ productId }: { productId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"retry" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setLoading("retry");
    setError(null);
    const res = await fetch(`/api/admin/products/${productId}/approve`, {
      method: "POST",
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Error publishing to Shopify");
      return;
    }
    router.refresh();
  };

  const remove = async () => {
    setLoading("remove");
    setError(null);
    const res = await fetch(`/api/admin/products/${productId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Error removing listing");
      return;
    }
    router.refresh();
  };

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button
          onClick={retry}
          disabled={loading !== null}
          className="rounded-md bg-status-published px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
        >
          {loading === "retry" ? "Retrying..." : "Retry publish"}
        </button>
        <button
          onClick={remove}
          disabled={loading !== null}
          className="rounded-md border border-status-rejected px-3 py-1.5 text-xs font-medium text-status-rejected transition disabled:opacity-50"
        >
          {loading === "remove" ? "Removing..." : "Remove"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-status-rejected">{error}</p>}
    </div>
  );
}
