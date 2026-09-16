"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import EditPriceButton from "@/components/EditPriceButton";
import { calculateSellingPrice } from "@/lib/pricing";
import type { Product, Commission } from "@/lib/types";

type Props = {
  products: Product[];
  commissions: Commission[];
  sales: any[];
  bestCompetitorPrice?: Record<string, number>;
  vacationMode?: boolean;
  username?: string;
};

const money = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

// Icono de spinner inline
function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Status pill: solo Active o Inactive, sin Pending visible al seller ──
// El admin ve el estado real (pending/rejected), el seller solo ve
// si su listing está vivo o no — menos confusión, más claridad.
function StatusPill({ product, vacation }: { product: Product; vacation?: boolean }) {
  const isLive = product.status === "published";
  const isPending = product.status === "pending";
  const isIssue = product.status === "rejected";
  const isInactive = product.status === "removed";

  // Vacation mode: todo pasa a Inactive visualmente
  if (vacation && (isLive || isPending)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium bg-surface-3 text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
        Inactive
      </span>
    );
  }

  if (isLive) return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium bg-accent-soft text-accent">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      Active
    </span>
  );

  // Pending: el admin aún no lo ha aprobado.
  // Al seller lo mostramos como "Active" con un punto diferente para
  // no confundirle — desde su perspectiva lo ha enviado correctamente.
  if (isPending) return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium bg-accent-soft text-accent">
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
      Active
    </span>
  );

  if (isIssue) return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium bg-[var(--status-rejected-bg)] text-[var(--status-rejected)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-rejected)]" />
      Issue
    </span>
  );

  // removed / inactive
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium bg-surface-3 text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
      Inactive
    </span>
  );
}

// ── Toggle Active/Inactive — interruptor con spinner de carga ─────
function ActiveToggle({ product, onToggle }: { product: Product; onToggle: (newStatus: string) => void }) {
  const [loading, setLoading] = useState(false);
  const isActive = product.status === "published" || product.status === "pending";
  const isInactive = product.status === "removed";
  if (!isActive && !isInactive) return null;

  const handle = async () => {
    if (loading) return;
    setLoading(true);
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isActive ? "deactivate" : "activate" }),
    });
    setLoading(false);
    if (res.ok) {
      // Usar el status real que devuelve la API (activate → "pending", deactivate → "removed")
      const data = await res.json().catch(() => null);
      onToggle(data?.status ?? (isActive ? "removed" : "pending"));
    }
  };

  return (
    <button
      onClick={handle}
      disabled={loading}
      title={isActive ? "Set inactive" : "Set active"}
      aria-label={isActive ? "Set inactive" : "Set active"}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-40 ${
        isActive ? "bg-accent" : "bg-border-strong"
      }`}
    >
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center text-white">
          <Spinner />
        </span>
      ) : (
        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${isActive ? "translate-x-4" : "translate-x-0"}`} />
      )}
    </button>
  );
}

// ── Best price: solo para published (no pending, no inactive) ─────
// En pending aún no está live en la tienda así que no compite de verdad.
function BestPrice({ product, competitorPrice }: { product: Product; competitorPrice?: number }) {
  if (!["published", "pending"].includes(product.status)) return <span className="text-[11px] text-faint">—</span>;
  const myPrice = calculateSellingPrice(product.desired_price);
  if (myPrice === null) return <span className="text-[11px] text-faint">—</span>;

  const isBest = competitorPrice === undefined || myPrice <= competitorPrice;
  return isBest ? (
    <span className="text-[11px] font-semibold text-accent">✓ Yes</span>
  ) : (
    <span className="text-[11px] font-medium text-[var(--status-pending)]">No</span>
  );
}

// ── Papelera con spinner ───────────────────────────────────────────
function TrashButton({ productId, onRemoved }: { productId: string; onRemoved: () => void }) {
  const [state, setState] = useState<"idle" | "confirm" | "loading">("idle");

  const remove = async () => {
    setState("loading");
    const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
    if (res.ok) {
      onRemoved();
    } else {
      setState("confirm"); // volvemos a confirm si falla
    }
  };

  if (state === "loading") {
    return (
      <span className="flex h-7 w-7 items-center justify-center text-faint">
        <Spinner />
      </span>
    );
  }

  if (state === "confirm") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-muted">Sure?</span>
        <button onClick={remove} className="text-[11px] font-medium text-[var(--status-rejected)] underline">
          Yes
        </button>
        <button onClick={() => setState("idle")} className="text-[11px] text-muted underline">
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setState("confirm")}
      aria-label="Remove listing"
      title="Remove listing"
      className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-[var(--status-rejected-bg)] hover:text-[var(--status-rejected)]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}

export default function DashboardClient({
  products: initialProducts,
  commissions,
  sales,
  bestCompetitorPrice = {},
  vacationMode = false,
  username,
}: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");

  const allListings = useMemo(
    () => products.filter((p) => ["published", "pending", "rejected", "removed"].includes(p.status)),
    [products]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return allListings;
    const q = search.toLowerCase();
    return allListings.filter(
      (p) =>
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        p.size.toLowerCase().includes(q)
    );
  }, [allListings, search]);

  const totalEarned   = commissions.reduce((s, c) => s + c.consignor_amount, 0);
  const totalSold     = commissions.length;
  const pendingAmount = commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.consignor_amount, 0);
  const now           = new Date();
  const thisMonth     = commissions
    .filter((c) => {
      const d = new Date(c.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, c) => s + c.consignor_amount, 0);

  const handleToggle = useCallback((productId: string, newStatus: string) => {
    setProducts((prev) =>
      prev.map((p) => p.id === productId ? { ...p, status: newStatus as any } : p)
    );
  }, []);

  const handleRemove = useCallback((productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  return (
    <div className="space-y-7">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {username && <p className="label-eyebrow mb-1">Welcome back</p>}
          <h1 className="title-page text-[1.75rem]">{username ?? "My listings"}</h1>
        </div>
        <Link href="/dashboard/new" className="btn btn-primary gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add a pair
        </Link>
      </div>

      {vacationMode && (
        <div className="callout callout-warning animate-in">
          Vacation mode is active — your listings are paused and not visible in the store.
        </div>
      )}

      {/* Métricas */}
      {totalSold > 0 && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total earned",   value: money(totalEarned)   },
            { label: "This month",     value: money(thisMonth)     },
            { label: "Pairs sold",     value: String(totalSold)    },
            { label: "Pending payout", value: money(pendingAmount) },
          ].map((m) => (
            <div key={m.label} className="card p-4">
              <p className="label-eyebrow">{m.label}</p>
              <p className="metric mt-1.5 text-xl">{m.value}</p>
            </div>
          ))}
        </section>
      )}

      {/* Buscador */}
      <div className="relative max-w-xs">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="7.5" />
          <path d="m20 20-3.9-3.9" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Brand, model or size…"
          className="input input-with-icon"
        />
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <EmptyListings search={search} />
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>Product</th>
                <th>Size</th>
                <th>Payout</th>
                <th>Best price</th>
                <th>Status</th>
                <th style={{ width: "1px" }} />
              </tr>
            </thead>
            <tbody className="stagger">
              {filtered.map((p, i) => {
                const compKey = p.shopify_variant_id ?? "";
                const competitorPrice = bestCompetitorPrice[compKey];
                const isInactive = p.status === "removed";

                return (
                  <tr
                    key={p.id}
                    style={{ "--index": i } as React.CSSProperties}
                    className={isInactive ? "opacity-40" : ""}
                  >
                    {/* Producto */}
                    <td>
                      <div className="flex items-center gap-3">
                        {p.photos?.[0] ? (
                          <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-surface-2">
                            <Image src={p.photos[0]} alt="" fill sizes="44px" className="object-contain p-0.5" />
                          </div>
                        ) : (
                          <div className="h-11 w-11 flex-shrink-0 rounded-lg bg-surface-2" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium">{p.brand}</p>
                          <p className="truncate text-[12px] text-muted">{p.model}</p>
                        </div>
                      </div>
                    </td>

                    <td><span className="chip">EU {p.size}</span></td>

                    <td><span className="num font-medium">€{p.desired_price.toFixed(0)}</span></td>

                    <td>
                      <BestPrice product={p} competitorPrice={competitorPrice} />
                    </td>

                    {/* Status: pill + toggle */}
                    <td>
                      <div className="flex items-center gap-2.5">
                        <StatusPill product={p} vacation={vacationMode} />
                        {!vacationMode && (
                          <ActiveToggle
                            product={p}
                            onToggle={(newStatus) => handleToggle(p.id, newStatus)}
                          />
                        )}
                      </div>
                      {p.status === "rejected" && p.admin_notes && (
                        <p className="mt-0.5 text-[11px] text-[var(--status-rejected)]">{p.admin_notes}</p>
                      )}
                    </td>

                    {/* Acciones */}
                    <td>
                      <div className="flex items-center justify-end gap-0.5">
                        {(p.status === "published" || p.status === "pending") && (
                          <EditPriceButton
                            productId={p.id}
                            currentPrice={p.desired_price}
                            originalPrice={p.original_price}
                            competitorSellingPrice={competitorPrice}
                            isBestPrice={calculateSellingPrice(p.desired_price) !== null && (competitorPrice === undefined || (calculateSellingPrice(p.desired_price) ?? Infinity) <= competitorPrice)}
                          />
                        )}
                        <TrashButton
                          productId={p.id}
                          onRemoved={() => handleRemove(p.id)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyListings({ search }: { search: string }) {
  if (search) {
    return (
      <div className="empty-state">
        <p className="title-section">Nothing matches "{search}"</p>
        <p className="mt-1.5 text-sm text-muted">Try a different brand, model or size.</p>
      </div>
    );
  }
  return (
    <div className="empty-state py-20">
      <svg className="mb-4 h-10 w-10 text-border-strong" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        <rect x="3" y="6" width="18" height="14" rx="2" />
        <path d="M3 10h18M8 6V4M16 6V4" strokeLinecap="round" />
      </svg>
      <p className="title-section">No listings yet</p>
      <p className="mt-1.5 text-sm text-muted">Add your first pair and we'll put it live on the store.</p>
      <Link href="/dashboard/new" className="btn btn-primary mt-5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add a pair
      </Link>
    </div>
  );
}
