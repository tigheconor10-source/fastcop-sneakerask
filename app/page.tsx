"use client";

import { useEffect, useState } from "react";
import { netCost } from "../lib/vat";

type SneakeraskSize = {
  size: string;
  listing_exists: boolean;
  listing_id: number | null;
  lowest_standard_ask: number | null;
  lowest_express_ask: number | null;
};

type SneakeraskProduct = {
  id: number;
  title: string;
  sku: string;
  brand: string;
  image: string | null;
  sizes: SneakeraskSize[];
};

type TrackedListing = {
  id: string;
  sneakerask_product_id: number;
  sneakerask_listing_id: number | null;
  sku: string;
  title: string;
  image: string | null;
  size: string;
  cost_price: number;
  cost_includes_vat: boolean;
  min_profit: number;
  ask_price: number;
  quantity: number;
  status: string;
  target_ask_type: "standard" | "express";
  last_is_best: boolean | null;
  last_lowest_standard_ask: number | null;
  last_checked_at: string | null;
};

type OwnListing = {
  id: number;
  productId: number | null;
  sku: string;
  title: string;
  brand: string | null;
  image: string | null;
  size: string;
  quantity: number;
  price: number;
  standardAsk: number | null;
  expressAsk: number | null;
  isBestListing: boolean;
  bestListingType: string | null;
  status: string;
  createdAt: string | null;
  alreadyTracked: boolean;
};

function editSneakeraskUrl(sku: string) {
  return `https://sell.sneakerask.com/seller/listings?search=${encodeURIComponent(sku)}`;
}

const TAB_STORAGE_KEY = "fastcop_ops_tab";

function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ImportGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MenuGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Home() {
  const [tab, setTab] = useState<"search" | "import">("search");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Recuerda en qué pestaña estabas, aunque recargues la página.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(TAB_STORAGE_KEY) : null;
    if (saved === "search" || saved === "import") setTab(saved);
    setHydrated(true);
  }, []);

  function changeTab(next: "search" | "import") {
    setTab(next);
    setDrawerOpen(false);
    window.localStorage.setItem(TAB_STORAGE_KEY, next);
  }

  // ── Buscar y crear ──────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SneakeraskProduct[]>([]);
  const [searching, setSearching] = useState(false);

  const [form, setForm] = useState<{ product: SneakeraskProduct; size: SneakeraskSize } | null>(null);
  const [editing, setEditing] = useState<TrackedListing | null>(null);
  const [editAskPrice, setEditAskPrice] = useState("");
  const [editQuantity, setEditQuantity] = useState("1");
  const [editStatus, setEditStatus] = useState<"active" | "draft">("active");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editCostIncludesVat, setEditCostIncludesVat] = useState(true);
  const [editMinProfit, setEditMinProfit] = useState("20");
  const [editTargetAsk, setEditTargetAsk] = useState<"standard" | "express">("standard");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [costIncludesVat, setCostIncludesVat] = useState(true);
  const [minProfit, setMinProfit] = useState("20");
  const [askPrice, setAskPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [targetAsk, setTargetAsk] = useState<"standard" | "express">("standard");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // ── Importar anuncios que ya tenías ─────────────────────────
  const [ownListings, setOwnListings] = useState<OwnListing[]>([]);
  const [loadingOwn, setLoadingOwn] = useState(false);
  const [ownError, setOwnError] = useState("");
  const [selectedImport, setSelectedImport] = useState<Record<number, { costPrice: string; minProfit: string; costIncludesVat: boolean; targetAskType: "standard" | "express" }>>({});
  const [bulkCost, setBulkCost] = useState("");
  const [bulkMinProfit, setBulkMinProfit] = useState("20");
  const [bulkCostIncludesVat, setBulkCostIncludesVat] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  // ── Vigilados ────────────────────────────────────────────────
  const [tracked, setTracked] = useState<TrackedListing[]>([]);
  const [repricingId, setRepricingId] = useState<string | null>(null);
  const [log, setLog] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [trackedFilter, setTrackedFilter] = useState("");
  const [orphaned, setOrphaned] = useState<{ id: string; title: string; size: string; sku: string }[]>([]);

  function append(text: string) {
    setLog((prev) => (prev ? prev + "\n" : "") + text);
  }

  async function loadTracked() {
    try {
      const res = await fetch("/api/listings");
      const text = await res.text();
      const data = text ? JSON.parse(text) : { listings: [] };
      if (data.error) append("No se pudieron cargar los anuncios vigilados: " + data.error);
      setTracked(data.listings || []);
    } catch (e: any) {
      append("No se pudieron cargar los anuncios vigilados: " + e.message);
      setTracked([]);
    }
  }

  useEffect(() => {
    loadTracked();
  }, []);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch(`/api/sneakerask/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.items || []);
    } catch (e: any) {
      append("ERROR buscando: " + e.message);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      search();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function openForm(product: SneakeraskProduct, size: SneakeraskSize) {
    setForm({ product, size });
    setCostPrice("");
    setCostIncludesVat(true);
    setMinProfit("20");
    setTargetAsk("standard");
    setAskPrice(size.lowest_standard_ask ? String(Math.max(1, size.lowest_standard_ask - 1)) : "");
    setQuantity("1");
    setFormError("");
  }

  function suggestAskFor(target: "standard" | "express") {
    if (!form) return;
    const base = target === "standard" ? form.size.lowest_standard_ask : form.size.lowest_express_ask;
    setTargetAsk(target);
    setAskPrice(base ? String(Math.max(1, base - 1)) : "");
  }

  const realCost = costPrice ? netCost(parseFloat(costPrice), costIncludesVat) : null;
  const profit = realCost !== null && askPrice ? parseFloat(askPrice) - realCost : null;
  const floor = realCost !== null && minProfit ? realCost + parseFloat(minProfit) : null;

  async function saveListing() {
    if (!form) return;
    if (!costPrice || !askPrice) {
      setFormError("Faltan el precio de coste o el de venta");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sneakeraskProductId: form.product.id,
          sku: form.product.sku,
          title: form.product.title,
          image: form.product.image,
          brand: form.product.brand,
          size: form.size.size,
          costPrice: parseFloat(costPrice),
          costIncludesVat,
          minProfit: parseFloat(minProfit),
          askPrice: parseFloat(askPrice),
          quantity: parseInt(quantity, 10) || 1,
          targetAskType: targetAsk,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setForm(null);
      loadTracked();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function repriceNow(id: string) {
    setRepricingId(id);
    try {
      const res = await fetch(`/api/listings/${id}/reprice`, { method: "POST" });
      const data = await res.json();
      append(`${data.title ?? ""} (talla ${data.size ?? ""}): ${data.message ?? data.error ?? "sin respuesta"}`);
      loadTracked();
    } catch (e: any) {
      append("ERROR: " + e.message);
    } finally {
      setRepricingId(null);
    }
  }

  async function removeTracked(id: string) {
    if (!confirm("¿Eliminar este anuncio de sneakerask y dejar de vigilarlo?")) return;
    await fetch(`/api/listings/${id}`, { method: "DELETE" });
    setOrphaned((prev) => prev.filter((o) => o.id !== id));
    loadTracked();
  }

  function openEdit(t: TrackedListing) {
    setEditing(t);
    setEditAskPrice(String(t.ask_price));
    setEditQuantity(String(t.quantity));
    setEditStatus(t.status === "draft" ? "draft" : "active");
    setEditCostPrice(String(t.cost_price));
    setEditCostIncludesVat(t.cost_includes_vat);
    setEditMinProfit(String(t.min_profit));
    setEditTargetAsk(t.target_ask_type === "express" ? "express" : "standard");
    setEditError("");
  }

  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    setEditError("");
    try {
      const res = await fetch(`/api/listings/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          askPrice: parseFloat(editAskPrice),
          quantity: parseInt(editQuantity, 10) || 1,
          status: editStatus,
          costPrice: parseFloat(editCostPrice),
          costIncludesVat: editCostIncludesVat,
          minProfit: parseFloat(editMinProfit) || 0,
          targetAskType: editTargetAsk,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      append(`Actualizado: ${editing.title} — talla ${editing.size}.`);
      setEditing(null);
      loadTracked();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function testWebhook() {
    setTestingWebhook(true);
    try {
      const res = await fetch("/api/webhook/test", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      append("Aviso de prueba enviado a tu canal de Discord — revísalo.");
    } catch (e: any) {
      append("ERROR probando el webhook: " + e.message);
    } finally {
      setTestingWebhook(false);
    }
  }

  async function syncWithSneakerask() {
    setSyncing(true);
    try {
      const res = await fetch("/api/listings/sync", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOrphaned(data.orphaned || []);
      append(
        `Sincronizado: ${data.checked} comprobados, ${data.updated} actualizados con el dato real` +
          (data.imagesFilled ? `, ${data.imagesFilled} imagen(es) rellenada(s)` : "") +
          (data.orphaned?.length ? `, ${data.orphaned.length} ya no existen en sneakerask (revísalos abajo).` : ".")
      );
      loadTracked();
    } catch (e: any) {
      append("ERROR sincronizando: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function removeAllOrphaned() {
    if (!confirm(`¿Quitar de la vigilancia los ${orphaned.length} anuncios que ya no existen en sneakerask?`)) return;
    for (const o of orphaned) {
      await fetch(`/api/listings/${o.id}`, { method: "DELETE" });
    }
    setOrphaned([]);
    loadTracked();
  }

  async function loadOwnListings() {
    setLoadingOwn(true);
    setOwnError("");
    try {
      const res = await fetch("/api/sneakerask/own-listings");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOwnListings(data.items || []);
    } catch (e: any) {
      setOwnError(e.message);
      append("ERROR cargando tus anuncios de sneakerask: " + e.message);
    } finally {
      setLoadingOwn(false);
    }
  }

  useEffect(() => {
    if (hydrated && tab === "import" && ownListings.length === 0 && !loadingOwn) {
      loadOwnListings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hydrated]);

  const importable = ownListings.filter((l) => !l.alreadyTracked);
  const selectedCount = Object.keys(selectedImport).length;

  function toggleImportSelect(listingId: number) {
    setSelectedImport((prev) => {
      const next = { ...prev };
      if (next[listingId]) {
        delete next[listingId];
      } else {
        next[listingId] = { costPrice: bulkCost, minProfit: bulkMinProfit, costIncludesVat: bulkCostIncludesVat, targetAskType: "standard" };
      }
      return next;
    });
  }

  function selectAllImportable() {
    const next: typeof selectedImport = {};
    for (const l of importable) {
      next[l.id] = { costPrice: bulkCost, minProfit: bulkMinProfit, costIncludesVat: bulkCostIncludesVat, targetAskType: "standard" };
    }
    setSelectedImport(next);
  }

  function applyBulkToSelected() {
    setSelectedImport((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        next[Number(id)] = { ...next[Number(id)], costPrice: bulkCost, minProfit: bulkMinProfit, costIncludesVat: bulkCostIncludesVat };
      }
      return next;
    });
  }

  function updateImportField(listingId: number, field: "costPrice" | "minProfit", value: string) {
    setSelectedImport((prev) => ({ ...prev, [listingId]: { ...prev[listingId], [field]: value } }));
  }

  async function importSelected() {
    setImportError("");
    const items = importable
      .filter((l) => selectedImport[l.id])
      .map((l) => ({
        sneakeraskListingId: l.id,
        sneakeraskProductId: l.productId ?? 0,
        sku: l.sku,
        title: l.title,
        image: l.image,
        brand: l.brand,
        size: l.size,
        askPrice: l.price,
        quantity: l.quantity,
        costPrice: parseFloat(selectedImport[l.id].costPrice),
        costIncludesVat: selectedImport[l.id].costIncludesVat,
        minProfit: parseFloat(selectedImport[l.id].minProfit) || 0,
        targetAskType: selectedImport[l.id].targetAskType,
      }));

    const missingCost = items.filter((i) => isNaN(i.costPrice));
    if (missingCost.length > 0) {
      setImportError(`Faltan precios de coste en ${missingCost.length} anuncio(s) seleccionados.`);
      return;
    }
    if (items.length === 0) {
      setImportError("Selecciona al menos un anuncio.");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/listings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      append(`Importados ${data.imported} anuncio(s) — ya están siendo vigilados.`);
      setSelectedImport({});
      loadOwnListings();
      loadTracked();
    } catch (e: any) {
      setImportError(e.message);
    } finally {
      setImporting(false);
    }
  }

  if (!hydrated) return null;

  return (
    <main className="page">
      <div className="app-header">
        <div>
          <div className="pulse-icon">
            <span style={{ height: 8, background: "var(--accent)" }} />
            <span style={{ height: 16, background: "var(--accent)" }} />
            <span style={{ height: 11, background: "var(--accent)" }} />
            <span style={{ height: 20, background: "var(--accent)" }} />
          </div>
          <h1 className="page-title">Anuncios</h1>
          <p className="page-subtitle">
            Busca productos, ponles coste y beneficio mínimo, e importa lo que ya tenías creado.
            Los precios se mantienen competitivos solos, sin que pierdas margen.
          </p>
        </div>
        <button className="menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú">
          <MenuGlyph />
        </button>
      </div>

      <div className="stat-chip">{tracked.length} anuncio{tracked.length === 1 ? "" : "s"} bajo vigilancia</div>

      {drawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <div className="drawer-panel">
            <div className="drawer-header">
              <span className="drawer-title">Secciones</span>
              <button className="icon-btn" style={{ color: "var(--ink-faint)" }} onClick={() => setDrawerOpen(false)}>
                <CloseGlyph />
              </button>
            </div>
            <button className={`drawer-item ${tab === "search" ? "active" : ""}`} onClick={() => changeTab("search")}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SearchGlyph />
                Buscar y crear
              </span>
            </button>
            <button className={`drawer-item ${tab === "import" ? "active" : ""}`} onClick={() => changeTab("import")}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ImportGlyph />
                Importar existentes
              </span>
              {importable.length > 0 && <span className="badge badge-neutral">{importable.length}</span>}
            </button>
          </div>
        </>
      )}

      {tab === "search" && (
        <>
          <p className="section-label">Buscar producto</p>
          <div className="card">
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="SKU, título o marca..."
              />
              <button className="btn btn-primary" onClick={search} disabled={searching}>
                {searching ? <span className="spinner" /> : "Buscar"}
              </button>
            </div>

            {results.map((p) => (
              <div key={p.id} className="card-quiet" style={{ padding: 12, marginBottom: 10, borderRadius: 12 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  {p.image ? <img src={p.image} alt="" className="product-thumb" /> : <div className="product-thumb-placeholder" />}
                  <div>
                    <div style={{ fontWeight: 650, fontSize: 14 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{p.brand} · {p.sku}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {p.sizes.map((s) => (
                    <button
                      key={s.size}
                      onClick={() => openForm(p, s)}
                      className="btn btn-secondary btn-sm"
                      title={`Lowest std: ${s.lowest_standard_ask ?? "-"}€ · express: ${s.lowest_express_ask ?? "-"}€`}
                    >
                      {s.size} {s.listing_exists ? "· ya tienes anuncio" : ""}
                      {s.lowest_standard_ask ? ` · std ${s.lowest_standard_ask}€` : ""}
                      {s.lowest_express_ask ? ` · exp ${s.lowest_express_ask}€` : ""}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!searching && query && results.length === 0 && <p className="empty-state">Sin resultados.</p>}
            {!query && <p className="empty-state">Escribe un SKU, título o marca para empezar.</p>}
          </div>
        </>
      )}

      {tab === "import" && (
        <>
          <p className="section-label">Anuncios ya existentes en sneakerask</p>
          <div className="card">
            {loadingOwn && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                <span className="spinner" style={{ borderTopColor: "var(--accent)" }} />
                <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>Cargando tus anuncios…</span>
              </div>
            )}

            {ownError && !loadingOwn && (
              <div style={{ background: "var(--red-soft)", color: "var(--red)", padding: "10px 12px", borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
                No se pudo cargar tu catálogo de sneakerask: {ownError}
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: 10 }} onClick={loadOwnListings}>
                  Reintentar
                </button>
              </div>
            )}

            {!loadingOwn && !ownError && importable.length === 0 && (
              <p className="empty-state">
                {ownListings.length === 0
                  ? "No se encontraron anuncios en tu cuenta de sneakerask."
                  : "Ya tienes todos tus anuncios importados y vigilados."}
              </p>
            )}

            {!loadingOwn && importable.length > 0 && (
              <>
                <div className="card-quiet" style={{ padding: 12, borderRadius: 12, marginBottom: 14 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 650, marginBottom: 8, color: "var(--ink-soft)" }}>
                    Coste y beneficio por defecto (se aplica a lo que marques)
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <label style={{ fontSize: 12 }}>
                      Coste (€)
                      <input className="input" style={{ width: 100, marginTop: 4 }} type="number" value={bulkCost} onChange={(e) => setBulkCost(e.target.value)} />
                    </label>
                    <label style={{ fontSize: 12 }}>
                      Beneficio mín. (€)
                      <input className="input" style={{ width: 100, marginTop: 4 }} type="number" value={bulkMinProfit} onChange={(e) => setBulkMinProfit(e.target.value)} />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, paddingBottom: 9 }}>
                      <input type="checkbox" checked={bulkCostIncludesVat} onChange={(e) => setBulkCostIncludesVat(e.target.checked)} />
                      Con IVA (21%)
                    </label>
                    <button className="btn btn-secondary btn-sm" onClick={applyBulkToSelected} disabled={selectedCount === 0}>
                      Aplicar a los marcados ({selectedCount})
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={selectAllImportable}>
                      Marcar todos ({importable.length})
                    </button>
                    {selectedCount > 0 && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedImport({})}>
                        Desmarcar todos
                      </button>
                    )}
                  </div>
                </div>

                {importable.map((l) => {
                  const sel = selectedImport[l.id];
                  return (
                    <div key={l.id} className={`listing-row ${sel ? "selected" : ""}`} style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                      <input
                        type="checkbox"
                        checked={!!sel}
                        onChange={() => toggleImportSelect(l.id)}
                        style={{ marginTop: 14, width: 16, height: 16, cursor: "pointer" }}
                      />
                      {l.image ? <img src={l.image} alt="" className="product-thumb" /> : <div className="product-thumb-placeholder" />}
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 650 }}>{l.title || l.sku} — talla {l.size}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
                          {l.brand ?? ""} {l.brand ? "·" : ""} {l.sku} · Ask actual: <strong>{l.price}€</strong>
                          {l.standardAsk != null && ` · mínimo std: ${l.standardAsk}€`}
                          {" · "}
                          {l.isBestListing ? (
                            <span className="badge badge-success">Mejor anuncio</span>
                          ) : (
                            <span className="badge badge-warning">No eres el mejor</span>
                          )}
                          {" "}
                          <span className={`badge ${l.status === "active" ? "badge-neutral" : "badge-warning"}`}>{l.status}</span>
                        </div>
                      </div>
                      {sel && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <label style={{ fontSize: 11 }}>
                            Coste
                            <input
                              className="input"
                              style={{ width: 80, marginTop: 2 }}
                              type="number"
                              value={sel.costPrice}
                              onChange={(e) => updateImportField(l.id, "costPrice", e.target.value)}
                            />
                          </label>
                          <label style={{ fontSize: 11 }}>
                            Benef. mín.
                            <input
                              className="input"
                              style={{ width: 80, marginTop: 2 }}
                              type="number"
                              value={sel.minProfit}
                              onChange={(e) => updateImportField(l.id, "minProfit", e.target.value)}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}

                {importError && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 10 }}>{importError}</p>}

                <button
                  className="btn btn-primary btn-block"
                  style={{ marginTop: 14 }}
                  onClick={importSelected}
                  disabled={importing || selectedCount === 0}
                >
                  {importing ? "Importando…" : `Importar ${selectedCount} anuncio(s) seleccionado(s)`}
                </button>
              </>
            )}

            {ownListings.some((l) => l.alreadyTracked) && (
              <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 14 }}>
                {ownListings.filter((l) => l.alreadyTracked).length} anuncio(s) ya están vigilados y no se muestran aquí.
              </p>
            )}
          </div>
        </>
      )}

      <div className="row-between" style={{ marginTop: 28 }}>
        <p className="section-label" style={{ margin: 0 }}>Vigilados ({tracked.length})</p>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={testWebhook} disabled={testingWebhook}>
            {testingWebhook ? <span className="spinner" style={{ borderTopColor: "var(--accent)" }} /> : "Probar webhook"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={syncWithSneakerask} disabled={syncing}>
            {syncing ? <span className="spinner" style={{ borderTopColor: "var(--accent)" }} /> : "Sincronizar con sneakerask"}
          </button>
        </div>
      </div>

      {tracked.length > 0 && (
        <input
          className="input"
          style={{ marginBottom: 10 }}
          placeholder="Filtrar por título, SKU o talla…"
          value={trackedFilter}
          onChange={(e) => setTrackedFilter(e.target.value)}
        />
      )}

      {orphaned.length > 0 && (
        <div className="card-quiet" style={{ borderRadius: 12, padding: 14, marginBottom: 10, borderColor: "var(--red)" }}>
          <p style={{ fontSize: 13, fontWeight: 650, color: "var(--red)", marginBottom: 8 }}>
            {orphaned.length} anuncio(s) ya no existen en sneakerask (los borraste allí) pero seguían vigilados aquí:
          </p>
          <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 12.5, color: "var(--ink-soft)" }}>
            {orphaned.map((o) => (
              <li key={o.id}>{o.title} — talla {o.size} ({o.sku})</li>
            ))}
          </ul>
          <button className="btn btn-danger btn-sm" onClick={removeAllOrphaned}>
            Quitar de la vigilancia ({orphaned.length})
          </button>
        </div>
      )}

      <div className="card">
        {tracked.length === 0 && <p className="empty-state">Ninguno todavía — busca un producto para empezar.</p>}
        {(() => {
          const q = trackedFilter.trim().toLowerCase();
          const visible = q
            ? tracked.filter((t) => t.title.toLowerCase().includes(q) || t.sku.toLowerCase().includes(q) || t.size.toLowerCase().includes(q))
            : tracked;
          if (tracked.length > 0 && visible.length === 0) {
            return <p className="empty-state">Nada coincide con "{trackedFilter}".</p>;
          }
          return visible.map((t) => {
          const realCostT = netCost(t.cost_price, t.cost_includes_vat);
          const profitNow = t.ask_price - realCostT;
          return (
            <div key={t.id} className="listing-row" style={{ flexWrap: "wrap" }}>
              {t.image ? <img src={t.image} alt="" className="product-thumb" /> : <div className="product-thumb-placeholder" />}
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13.5, fontWeight: 650, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {t.title} — talla {t.size}
                  <span className={`badge ${t.status === "active" ? "badge-success" : "badge-warning"}`}>{t.status === "active" ? "Active" : "Draft"}</span>
                  {t.last_is_best === true && <span className="badge badge-success"><span className="status-dot best" />Mejor anuncio</span>}
                  {t.last_is_best === false && <span className="badge badge-danger"><span className="status-dot undercut" />Te han bajado</span>}
                </div>
                <div className="price-mono" style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 3 }}>
                  Venta {t.ask_price}€ · Coste {t.cost_price}€{t.cost_includes_vat ? ` (${realCostT.toFixed(2)}€ sin IVA)` : ""} · Beneficio {profitNow.toFixed(2)}€ · Mínimo {(realCostT + t.min_profit).toFixed(2)}€ · {t.target_ask_type === "express" ? "Express" : "Standard"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}>
                  Editar
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => repriceNow(t.id)} disabled={repricingId !== null}>
                  {repricingId === t.id ? <span className="spinner" style={{ borderTopColor: "var(--accent)" }} /> : "Reajustar"}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => removeTracked(t.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          );
          });
        })()}
      </div>

      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(22,25,34,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }} onClick={() => setEditing(null)}>
          <div className="card" style={{ maxWidth: 460, width: "100%", background: "#fff", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>

            {/* Producto */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              {editing.image ? (
                <img src={editing.image} alt="" className="product-thumb" style={{ width: 56, height: 56 }} />
              ) : (
                <div className="product-thumb-placeholder" style={{ width: 56, height: 56 }} />
              )}
              <div>
                <p className="card-title" style={{ marginBottom: 2 }}>{editing.title}</p>
                <p className="card-hint" style={{ margin: 0 }}>Talla {editing.size} · {editing.sku}</p>
              </div>
            </div>

            {/* Sección: Estado */}
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>Estado</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setEditStatus("active")}
                style={editStatus === "active" ? { background: "var(--green)", color: "#fff", borderColor: "var(--green)" } : { background: "var(--card)", border: "1px solid var(--border)" }}
              >
                Active
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setEditStatus("draft")}
                style={editStatus === "draft" ? { background: "var(--amber)", color: "#fff", borderColor: "var(--amber)" } : { background: "var(--card)", border: "1px solid var(--border)" }}
              >
                Draft
              </button>
            </div>

            {/* Sección: Precio y stock */}
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>Precio y stock</p>
            <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
              <label className="field" style={{ display: "block", flex: 2, fontSize: 13, fontWeight: 600 }}>
                Precio de venta (€)
                <input className="input" style={{ marginTop: 4 }} value={editAskPrice} onChange={(e) => setEditAskPrice(e.target.value)} type="number" />
              </label>
              <label className="field" style={{ display: "block", flex: 1, fontSize: 13, fontWeight: 600 }}>
                Cantidad
                <input className="input" style={{ marginTop: 4 }} value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} type="number" />
              </label>
            </div>

            {/* Avisos "list €X or less to beat" — igual que el propio sneakerask */}
            {(editing.last_lowest_standard_ask != null || editing.last_lowest_express_ask != null) && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {editing.last_lowest_standard_ask != null && (
                  <button
                    type="button"
                    onClick={() => setEditAskPrice(String(Math.max(1, Math.floor(editing.last_lowest_standard_ask! - 1))))}
                    className="badge badge-warning"
                    style={{ cursor: "pointer", border: "none", fontSize: 12 }}
                    title="Clic para rellenar este precio"
                  >
                    Pon €{Math.max(1, Math.floor(editing.last_lowest_standard_ask - 1))} o menos para ganar en Standard
                  </button>
                )}
                {editing.last_lowest_express_ask != null && (
                  <button
                    type="button"
                    onClick={() => setEditAskPrice(String(Math.max(1, Math.floor(editing.last_lowest_express_ask! - 1))))}
                    className="badge"
                    style={{ cursor: "pointer", border: "none", fontSize: 12, background: "var(--accent-soft)", color: "var(--accent)" }}
                    title="Clic para rellenar este precio"
                  >
                    Pon €{Math.max(1, Math.floor(editing.last_lowest_express_ask - 1))} o menos para ganar en Express
                  </button>
                )}
              </div>
            )}

            {/* Sección: Competencia */}
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>Compites en</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setEditTargetAsk("standard")}
                style={editTargetAsk === "standard" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : { background: "var(--card)", border: "1px solid var(--border)" }}
              >
                Standard
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setEditTargetAsk("express")}
                style={editTargetAsk === "express" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : { background: "var(--card)", border: "1px solid var(--border)" }}
              >
                Express
              </button>
            </div>

            {/* Sección: Coste y margen */}
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>Coste y margen (privado)</p>
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                <label className="field" style={{ display: "block", flex: 1, fontSize: 13, fontWeight: 600 }}>
                  Coste (€)
                  <input className="input" style={{ marginTop: 4 }} value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value)} type="number" />
                </label>
                <label className="field" style={{ display: "block", flex: 1, fontSize: 13, fontWeight: 600 }}>
                  Beneficio mínimo (€)
                  <input className="input" style={{ marginTop: 4 }} value={editMinProfit} onChange={(e) => setEditMinProfit(e.target.value)} type="number" />
                </label>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginBottom: 0, cursor: "pointer" }}>
                <input type="checkbox" checked={editCostIncludesVat} onChange={(e) => setEditCostIncludesVat(e.target.checked)} />
                Ese precio lleva el 21% de IVA incluido (deducible)
              </label>

              {editCostPrice && editMinProfit && (
                <p style={{ fontSize: 13, background: "var(--accent-soft)", color: "var(--accent-hover)", padding: "8px 12px", borderRadius: 10, marginTop: 10, marginBottom: 0 }}>
                  {editCostIncludesVat && (
                    <>Coste real sin IVA: <strong>{netCost(parseFloat(editCostPrice) || 0, editCostIncludesVat).toFixed(2)}€</strong><br /></>
                  )}
                  Precio mínimo permitido: <strong>{(netCost(parseFloat(editCostPrice) || 0, editCostIncludesVat) + (parseFloat(editMinProfit) || 0)).toFixed(2)}€</strong>
                </p>
              )}
            </div>

            {editError && <p style={{ fontSize: 13, background: "var(--red-soft)", color: "var(--red)", padding: "8px 12px", borderRadius: 10 }}>{editError}</p>}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? "Guardando…" : "Guardar cambios"}
              </button>
              <a
                href={editSneakeraskUrl(editing.sku)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ textDecoration: "none", marginLeft: "auto" }}
              >
                Ver en sneakerask
              </a>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(22,25,34,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }} onClick={() => setForm(null)}>
          <div className="card" style={{ maxWidth: 420, width: "100%", background: "#fff" }} onClick={(e) => e.stopPropagation()}>
            <p className="card-title">{form.product.title} — talla {form.size.size}</p>
            <p className="card-hint">
              Lowest ask ahora mismo: {form.size.lowest_standard_ask ?? "-"}€ (standard) · {form.size.lowest_express_ask ?? "-"}€ (express)
            </p>

            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => suggestAskFor("standard")}
                style={targetAsk === "standard" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : { background: "var(--card)", border: "1px solid var(--border)" }}
              >
                Competir en Standard{form.size.lowest_standard_ask ? ` (${form.size.lowest_standard_ask}€)` : ""}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => suggestAskFor("express")}
                style={targetAsk === "express" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : { background: "var(--card)", border: "1px solid var(--border)" }}
              >
                Competir en Express{form.size.lowest_express_ask ? ` (${form.size.lowest_express_ask}€)` : ""}
              </button>
            </div>

            <label className="field" style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
              Precio de coste (privado, solo lo ves tú)
              <input className="input" style={{ marginTop: 4 }} value={costPrice} onChange={(e) => setCostPrice(e.target.value)} type="number" />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={costIncludesVat} onChange={(e) => setCostIncludesVat(e.target.checked)} />
              Ese precio lleva el 21% de IVA incluido (deducible)
            </label>
            {realCost !== null && costIncludesVat && (
              <p className="vat-note">Coste real sin IVA: {realCost.toFixed(2)}€ — es el que cuenta para el margen</p>
            )}
            <label className="field" style={{ display: "block", marginTop: 10, marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
              Beneficio mínimo que quieres siempre (€)
              <input className="input" style={{ marginTop: 4 }} value={minProfit} onChange={(e) => setMinProfit(e.target.value)} type="number" />
            </label>
            <label className="field" style={{ display: "block", marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
              Precio de venta en sneakerask
              <input className="input" style={{ marginTop: 4 }} value={askPrice} onChange={(e) => setAskPrice(e.target.value)} type="number" />
            </label>
            <label className="field" style={{ display: "block", marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
              Cantidad
              <input className="input" style={{ marginTop: 4 }} value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" />
            </label>

            {profit !== null && (
              <p style={{ fontSize: 13, background: "var(--accent-soft)", color: "var(--accent-hover)", padding: "8px 12px", borderRadius: 10 }}>
                Beneficio con este precio: <strong>{profit.toFixed(2)}€</strong>
                {floor !== null && ` · Precio mínimo permitido: ${floor.toFixed(2)}€`}
              </p>
            )}
            {formError && <p style={{ fontSize: 13, background: "var(--red-soft)", color: "var(--red)", padding: "8px 12px", borderRadius: 10 }}>{formError}</p>}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveListing} disabled={saving}>
                {saving ? "Creando…" : "Crear anuncio y empezar a vigilar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {log && (
        <div className="log-box">
          <div className="log-header">
            <span className="log-header-title">Resultado</span>
            <button className="icon-btn" onClick={() => setLog("")}>Limpiar</button>
          </div>
          <div className="log-body">
            {log.split("\n").map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
