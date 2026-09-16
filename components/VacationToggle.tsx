"use client";

import { useState } from "react";

export default function VacationToggle({
  active,
  pausedCount,
}: {
  active: boolean;
  pausedCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (enable: boolean) => {
    setLoading(true);
    setError(null);
    setConfirming(false);

    const res = await fetch("/api/vacation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enable }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error");
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">
            {active ? "🌴 Vacation mode is ON" : "Vacation mode"}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {active
              ? `${pausedCount} listing${pausedCount !== 1 ? "s" : ""} paused. They'll come back when you deactivate.`
              : "Pauses all your live listings instantly. Reactivate to restore them."}
          </p>
        </div>

        {active ? (
          <button
            onClick={() => toggle(false)}
            disabled={loading}
            className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            {loading ? "…" : "Deactivate"}
          </button>
        ) : confirming ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggle(true)}
              disabled={loading}
              className="rounded-lg bg-status-rejected px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-sm text-muted underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={loading}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted transition hover:border-foreground hover:text-foreground disabled:opacity-50"
          >
            Activate
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-status-rejected">{error}</p>}
    </div>
  );
}
