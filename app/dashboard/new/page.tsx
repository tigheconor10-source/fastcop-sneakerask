"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { type ShopifyCatalogItem, type VatType } from "@/lib/types";
import { maxPayoutForSellingPrice } from "@/lib/pricing";
import { sortSizes } from "@/lib/sizes";

const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), { ssr: false });

export default function NewProductPage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShopifyCatalogItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ShopifyCatalogItem | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSearching, setScanSearching] = useState(false);

  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [payouts, setPayouts] = useState<Record<string, string>>({});
  const [competitorPayout, setCompetitorPayout] = useState<Record<string, number>>({});

  const [vatType] = useState<VatType>("margin_scheme");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false); // guard contra doble envío
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live search
  useEffect(() => {
    if (selected) return;
    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Search error");
        setResults(data.results ?? []);
        setShowDropdown(true);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Search error");
        setShowDropdown(false);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selected]);

  // Close dropdown outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Competitor payouts when product selected
  useEffect(() => {
    if (!selected) { setCompetitorPayout({}); return; }
    const variantIds = Object.values(selected.variantIds).filter(Boolean);
    if (variantIds.length === 0) { setCompetitorPayout({}); return; }

    (async () => {
      try {
        const res = await fetch(`/api/catalog/competition?variantIds=${encodeURIComponent(variantIds.join(","))}`);
        const data = await res.json();
        if (!res.ok) return;
        const idToSize: Record<string, string> = {};
        for (const [size, id] of Object.entries(selected.variantIds)) idToSize[id] = size;
        const bySize: Record<string, number> = {};
        for (const [variantId, payout] of Object.entries(data.minPayout ?? {})) {
          const size = idToSize[variantId];
          if (size) bySize[size] = payout as number;
        }
        setCompetitorPayout(bySize);
      } catch {}
    })();
  }, [selected]);

  // ——— BARCODE DETECTED ———
  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    setShowScanner(false);
    setScanError(null);
    setScanSearching(true);

    try {
      // 1. Buscar en StockX por el barcode → obtener styleId
      const sxRes = await fetch(`/api/barcode?code=${encodeURIComponent(barcode)}`);
      const sxData = await sxRes.json();

      if (!sxRes.ok || !sxData.styleId) {
        // StockX no lo encontró → intentar búsqueda directa en Shopify con el barcode
        const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(barcode)}`);
        const data = await res.json();
        const items: ShopifyCatalogItem[] = data.results ?? [];
        if (items.length === 0) {
          setScanError(`Barcode ${barcode} not found. Try searching manually.`);
        } else if (items.length === 1) {
          setSelected(items[0]);
        } else {
          setResults(items);
          setQuery(barcode);
          setShowDropdown(true);
        }
        return;
      }

      // 2. Tenemos el styleId de StockX → buscar en Shopify
      const { styleId, euSize, approximate } = sxData;
      const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(styleId)}`);
      const data = await res.json();
      const items: ShopifyCatalogItem[] = data.results ?? [];

      if (items.length === 0) {
        setScanError(
          `Found "${sxData.productName}" on StockX (${styleId}) but it's not in your Shopify catalog.`
        );
        return;
      }

      // Seleccionar el producto
      setSelected(items[0]);
      setShowDropdown(false);

      // Si tenemos talla EU exacta del GTIN, pre-seleccionarla
      if (euSize && !approximate) {
        setSelectedSizes(new Set([euSize]));
      }
    } catch (e: any) {
      setScanError(`Scan error: ${e.message}`);
    } finally {
      setScanSearching(false);
    }
  }, []);

  const toggleSize = useCallback((size: string) => {
    setSelectedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(size)) {
        next.delete(size);
        setPayouts((p) => { const n = { ...p }; delete n[size]; return n; });
      } else {
        next.add(size);
      }
      return next;
    });
  }, []);

  const setPayout = (size: string, value: string) => {
    setPayouts((prev) => ({ ...prev, [size]: value }));
  };

  const reset = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    setSelectedSizes(new Set());
    setPayouts({});
    setCompetitorPayout({});
    setError(null);
    setScanError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return; // evitar doble envío
    setError(null);

    if (!selected) { setError("Select a sneaker first."); return; }
    if (selectedSizes.size === 0) { setError("Select at least one size."); return; }

    for (const size of Array.from(selectedSizes)) {
      const p = Number(payouts[size] ?? "");
      if (!p || p <= 0) {
        setError(`EU ${size}: enter a payout greater than €0.`);
        return;
      }
      const shopifyPrice = selected.prices[size];
      if (shopifyPrice != null) {
        const maxPayout = maxPayoutForSellingPrice(shopifyPrice);
        if (maxPayout !== null && p > maxPayout) {
          setError(`EU ${size}: max payout is €${maxPayout.toFixed(2)} (to match the current selling price).`);
          return;
        }
      }
    }

    setSubmitting(true);
    submittingRef.current = true;
    const errors: string[] = [];
    let okCount = 0;

    for (const size of Array.from(selectedSizes)) {
      const payoutPrice = Number(payouts[size]);
      const variantId = selected.variantIds[size];
      if (!variantId) { errors.push(`EU ${size}: no variant found`); continue; }

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: selected.sku,
          brand: selected.brand,
          model: selected.name,
          imageUrl: selected.image_url,
          productId: selected.productId,
          variants: { [size]: { variantId, price: selected.prices[size], sku: selected.variantSkus[size] } },
          sizes: [size],
          payoutPrice,
          vatType,
          isEssentials: selected.isEssentials,
        }),
      });
      const data = await res.json();
      if (!res.ok) { errors.push(`EU ${size}: ${data.error ?? "error"}`); continue; }
      const failed = (data.results ?? []).filter((r: any) => !r.ok);
      if (failed.length > 0) errors.push(`EU ${size}: ${failed[0].error}`);
      else okCount++;
    }

    setSubmitting(false);
    submittingRef.current = false;
    if (errors.length > 0) {
      setError(errors.join(" · "));
    }
    if (okCount > 0) {
      router.push("/dashboard");
      router.refresh();
    }
  };

  const sortedSizes = selected ? sortSizes(Object.keys(selected.prices)) : [];
  const allValid = selectedSizes.size > 0 &&
    Array.from(selectedSizes).every((s) => {
      const p = Number(payouts[s] ?? 0);
      if (p <= 0) return false;
      const shopifyPrice = selected?.prices[s];
      if (shopifyPrice != null) {
        const maxPayout = maxPayoutForSellingPrice(shopifyPrice);
        if (maxPayout !== null && p > maxPayout) return false;
      }
      return true;
    });

  return (
    <div className="mx-auto max-w-md pb-24">
      {/* Scanner overlay */}
      {showScanner && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowScanner(false)}
        />
      )}

      <div className="mb-7">
        <h1 className="title-page text-[1.75rem]">Add a pair</h1>
        <p className="mt-1 text-sm text-muted">Search by name or SKU. You can also scan the barcode on the box.</p>
      </div>

      {/* ── Search box ── */}
      <div ref={wrapperRef} className="relative mb-5">
        <div className={`flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 transition ${
          !selected ? "focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 border-border" : "border-border"
        }`}>

          {/* Search icon */}
          {!selected && !searching && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-muted" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}

          {(searching || scanSearching) && (
            <svg className="h-4 w-4 flex-shrink-0 animate-spin text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20"/>
              <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          )}

          {selected ? (
            <div className="flex flex-1 items-center gap-3">
              <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg bg-surface-hover">
                {selected.image_url && (
                  <Image src={selected.image_url} alt={selected.name} fill className="object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold">{selected.brand} {selected.name}</p>
                <p className="font-mono text-xs text-muted">{selected.sku}</p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="shrink-0 text-xs text-muted hover:text-foreground transition underline"
              >
                Change
              </button>
            </div>
          ) : (
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setShowDropdown(true)}
              placeholder="SKU or model name…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            />
          )}

          {!selected && query && !searching && (
            <button
              type="button"
              onClick={() => { setQuery(""); setResults([]); setShowDropdown(false); }}
              className="flex-shrink-0 text-muted hover:text-foreground transition"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* Scan button — solo cuando no hay producto seleccionado */}
          {!selected && (
            <button
              type="button"
              onClick={() => { setScanError(null); setShowScanner(true); }}
              title="Scan barcode"
              className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:border-accent hover:text-accent transition active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                <line x1="7" y1="12" x2="7" y2="12.01" strokeWidth="3"/>
                <line x1="10" y1="8" x2="10" y2="16" strokeWidth="1.8"/>
                <line x1="13" y1="10" x2="13" y2="14" strokeWidth="1.8"/>
                <line x1="16" y1="8" x2="16" y2="16" strokeWidth="1.8"/>
              </svg>
            </button>
          )}
        </div>

        {/* Dropdown */}
        {!selected && showDropdown && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
            {results.map((item, i) => (
              <button
                key={item.sku || item.name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setSelected(item); setShowDropdown(false); setQuery(""); setScanError(null); }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent/5 active:bg-accent/10 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-surface-hover">
                  {item.image_url && (
                    <Image src={item.image_url} alt={item.name} fill className="object-contain p-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold">{item.brand} {item.name}</p>
                  <p className="font-mono text-xs text-muted">{item.sku}</p>
                </div>
                <svg className="h-4 w-4 flex-shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ))}
          </div>
        )}

        {!selected && !searching && searchError && (
          <p className="mt-2 text-sm text-muted">{searchError}</p>
        )}
        {!selected && query.trim().length >= 2 && !searching && results.length === 0 && showDropdown && (
          <p className="mt-2 text-sm text-muted">No results found.</p>
        )}

        {/* Scan error */}
        {scanError && !selected && (
          <div className="callout callout-danger mt-2 flex items-start gap-2 py-2.5">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-rejected" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
            </svg>
            <p className="text-xs text-status-rejected">{scanError}</p>
          </div>
        )}
      </div>

      {/* ── Step 2: sizes + payouts ── */}
      {selected && selected.isEssentials && (
        <div className="callout callout-danger animate-in p-5 text-center">
          <p className="font-medium">This item can&apos;t be listed</p>
          <p className="mt-1 text-sm text-muted">
            Apparel sets/t-shirts (Essentials) aren&apos;t supported for consignment.
          </p>
          <button type="button" onClick={reset} className="mt-3 text-sm text-accent underline">
            Search for something else
          </button>
        </div>
      )}

      {selected && !selected.isEssentials && (
        <form onSubmit={handleSubmit} className="animate-in space-y-6">
          {/* Size grid */}
          <div>
            <p className="mb-3 text-sm font-semibold">Your sizes (EU)</p>
            {sortedSizes.length === 0 ? (
              <p className="text-sm text-status-rejected">
                No listable sizes found for this product (missing SKU data).
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
                {sortedSizes.map((size) => {
                  const active = selectedSizes.has(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => toggleSize(size)}
                      className={`relative rounded-lg border py-3 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
                        active
                          ? "border-transparent bg-ink text-white"
                          : "border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-2"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Per-size payout rows */}
          {selectedSizes.size > 0 && (
            <div className="animate-in">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="text-sm font-semibold">Your payout per size</p>
                <p className="text-xs text-muted">{selectedSizes.size} selected</p>
              </div>
              <div className="space-y-2.5">
                {sortSizes(Array.from(selectedSizes)).map((size) => {
                  const payout = payouts[size] ? Number(payouts[size]) : null;
                  const shopifyPrice = selected.prices[size];
                  const maxPayout = shopifyPrice != null ? maxPayoutForSellingPrice(shopifyPrice) : null;
                  const tooHigh = payout !== null && maxPayout !== null && payout > maxPayout;

                  const competitor = competitorPayout[size];
                  let suggested: number | null = null;
                  if (competitor !== undefined) {
                    let s = Math.floor(competitor - 1);
                    if (maxPayout !== null) s = Math.min(s, Math.floor(maxPayout));
                    if (s >= 1) suggested = s;
                  }
                  const showSuggestion =
                    suggested !== null && (payout === null || payout >= competitor);

                  const step = (delta: number) => {
                    const current = payout ?? 0;
                    let next = Math.max(0, current + delta);
                    if (maxPayout !== null) next = Math.min(next, Math.floor(maxPayout));
                    setPayout(size, String(next));
                  };

                  return (
                    <div key={size} className="card p-3.5">
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="chip">EU {size}</span>
                        {maxPayout != null && (
                          <span className={`text-xs ${tooHigh ? "font-semibold text-status-rejected" : "text-muted"}`}>
                            max €{maxPayout.toFixed(0)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => step(-1)}
                          disabled={(payout ?? 0) <= 0}
                          aria-label="Decrease payout"
                          className="btn btn-secondary h-10 w-10 shrink-0 p-0 text-lg disabled:opacity-30"
                        >
                          −
                        </button>

                        <div className={`flex flex-1 items-center justify-center gap-1 rounded-lg border bg-surface px-3 py-2.5 transition-colors duration-150 focus-within:border-accent ${tooHigh ? "border-status-rejected" : "border-border-strong"}`}>
                          <span className="text-base text-muted">€</span>
                          <input
                            type="number"
                            min={0}
                            max={maxPayout ?? undefined}
                            step="1"
                            value={payouts[size] ?? ""}
                            onChange={(e) => setPayout(size, e.target.value)}
                            placeholder="0"
                            className="w-full bg-transparent text-center font-mono text-lg font-medium tabular-nums outline-none placeholder:font-normal placeholder:text-faint"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => step(1)}
                          disabled={maxPayout !== null && (payout ?? 0) >= maxPayout}
                          aria-label="Increase payout"
                          className="btn btn-secondary h-10 w-10 shrink-0 p-0 text-lg disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>

                      {showSuggestion && (
                        <button
                          type="button"
                          onClick={() => setPayout(size, String(suggested))}
                          className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-md bg-accent-soft px-3 py-2 text-left text-xs text-accent transition-colors duration-150 hover:bg-accent-border/50"
                        >
                          <span>Best ask is €{competitor.toFixed(0)}</span>
                          <span className="font-medium">Set €{suggested} to undercut</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">This is what you receive when it sells.</p>
            </div>
          )}

          {error && (
            <div className="callout callout-danger">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting || !allValid}
            className="btn btn-primary btn-lg btn-block"
          >
            {submitting
              ? "Listing…"
              : `List ${selectedSizes.size} ${selectedSizes.size === 1 ? "size" : "sizes"}`}
          </button>
        </form>
      )}
    </div>
  );
}
