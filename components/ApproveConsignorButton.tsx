"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApproveConsignorButton({
  id,
  isApproved,
}: {
  id: string;
  isApproved: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handle = async (approve: boolean) => {
    setLoading(true);
    await fetch(`/api/admin/consignors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_approved: approve }),
    });
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="flex gap-3 w-full">
      <button
        onClick={() => handle(true)}
        disabled={loading || isApproved}
        className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: "var(--status-sold)", color: "#fff" }}
      >
        {isApproved ? "✓ Approved" : loading ? "..." : "Approve"}
      </button>
      <button
        onClick={() => handle(false)}
        disabled={loading || !isApproved}
        className="flex-1 rounded-xl border py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderColor: "var(--status-rejected)", color: "var(--status-rejected)" }}
      >
        {!isApproved ? "✗ Denied" : loading ? "..." : "Revoke access"}
      </button>
    </div>
  );
}
