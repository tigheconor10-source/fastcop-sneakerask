"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkPaidButton({ commissionId }: { commissionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/commissions/${commissionId}/mark-paid`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? `Error (${res.status})`);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-status-sold/10 px-3 py-1.5 text-sm font-semibold text-status-sold transition hover:bg-status-sold/20 disabled:opacity-50"
      >
        {loading ? "..." : "Mark paid"}
      </button>
      {error && <span className="text-xs text-status-rejected">{error}</span>}
    </div>
  );
}
