"use client";

import { useEffect, useState } from "react";

// Contador en tiempo real hasta `deadline`. Si `shippedAt` está puesto,
// muestra "Shipped" en verde en su lugar. Se actualiza cada segundo.
export default function ShippingCountdown({
  deadline,
  shippedAt,
}: {
  deadline: Date | null;
  shippedAt: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (shippedAt || !deadline) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [shippedAt, deadline]);

  if (shippedAt) {
    return <span className="text-xs font-medium text-status-sold">✓ Shipped</span>;
  }

  if (!deadline) {
    return <span className="text-xs text-muted">Waiting for label</span>;
  }

  const diffMs = deadline.getTime() - now;
  const late = diffMs < 0;
  const abs = Math.abs(diffMs);

  const totalSeconds = Math.floor(abs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours}h`, `${minutes}m`, `${seconds}s`);

  return (
    <span className={`font-mono text-xs tabular-nums ${late ? "font-semibold text-status-rejected" : "text-muted"}`}>
      {late ? "Overdue by " : ""}{parts.join(" ")}{!late ? " left" : ""}
    </span>
  );
}
