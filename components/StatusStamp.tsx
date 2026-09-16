const LABELS: Record<string, string> = {
  pending: "Pending",
  published: "Live",
  sold: "Sold",
  rejected: "Issue",
  removed: "Removed",
  unshipped: "To ship",
  shipped: "Shipped",
  delivered: "Delivered",
  paid: "Paid",
  late: "Late",
};

// Cada estado usa un pastel apagado de fondo con el texto oscuro a juego.
// Antes se calculaba el fondo con color-mix desde un color vivo, lo que
// daba tonos chillones e inconsistentes entre estados.
const TONES: Record<string, { fg: string; bg: string }> = {
  pending: { fg: "var(--status-pending)", bg: "var(--status-pending-bg)" },
  published: { fg: "var(--status-published)", bg: "var(--status-published-bg)" },
  sold: { fg: "var(--status-sold)", bg: "var(--status-sold-bg)" },
  rejected: { fg: "var(--status-rejected)", bg: "var(--status-rejected-bg)" },
  removed: { fg: "var(--status-neutral)", bg: "var(--status-neutral-bg)" },
  unshipped: { fg: "var(--status-unshipped)", bg: "var(--status-unshipped-bg)" },
  shipped: { fg: "var(--status-shipped)", bg: "var(--status-shipped-bg)" },
  delivered: { fg: "var(--status-delivered)", bg: "var(--status-delivered-bg)" },
  paid: { fg: "var(--status-sold)", bg: "var(--status-sold-bg)" },
  late: { fg: "var(--status-rejected)", bg: "var(--status-rejected-bg)" },
};

const NEUTRAL = { fg: "var(--status-neutral)", bg: "var(--status-neutral-bg)" };

export default function StatusStamp({ status }: { status: string }) {
  const label = LABELS[status] ?? status;
  const tone = TONES[status] ?? NEUTRAL;

  return (
    <span
      className="badge"
      style={{ color: tone.fg, backgroundColor: tone.bg }}
    >
      <span className="badge-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
