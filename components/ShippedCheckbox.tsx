"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ShippedCheckbox({ saleId, shipped }: { saleId: string; shipped: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/sales/${saleId}/shipped`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipped: !shipped }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? `Error (${res.status})`);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex items-center gap-1.5">
      <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
        <input
          type="checkbox"
          checked={shipped}
          disabled={loading}
          onChange={toggle}
          className="h-3.5 w-3.5 accent-accent"
        />
        Shipped
      </label>
      {error && <span className="text-xs text-status-rejected">{error}</span>}
    </div>
  );
}
