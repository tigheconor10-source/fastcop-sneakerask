"use client";

import { useEffect, useState } from "react";

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
  min_profit: number;
  ask_price: number;
  quantity: number;
  status: string;
  last_is_best: boolean | null;
  last_lowest_standard_ask: number | null;
  last_checked_at: string | null;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SneakeraskProduct[]>([]);
  const [searching, setSearching] = useState(false);

  const [form, setForm] = useState<{ product: SneakeraskProduct; size: SneakeraskSize } | null>(null);
  const [costPrice, setCostPrice] = useState("");
  const [minProfit, setMinProfit] = useState("20");
  const [askPrice, setAskPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [targetAsk, setTargetAsk] = useState<"standard" | "express">("standard");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [tracked, setTracked] = useState<TrackedListing[]>([]);
  const [repricingId, setRepricingId] = useState<string | null>(null);
  const [log, setLog] = useState("");

  function append(text: string) {
    setLog((prev) => (prev ? prev + "\n" : "") + text);
  }

  async function loadTracked() {
    try {
      const res = await fetch("/api/listings");
      const text = await res.text();
      const data = text ? JSON.parse(text) : { listings: [] };
      if (data.error) append("⚠ No se pudieron cargar los anuncios vigilados: " + data.error);
      setTracked(data.listings || []);
    } catch (e: any) {
      append("⚠ No se pudieron cargar los anuncios vigilados: " + e.message);
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

  function openForm(product: SneakeraskProduct, size: SneakeraskSize) {
    setForm({ product, size });
    setCostPrice("");
    setMinProfit("20");
    setTargetAsk("standard");
    // Antes solo se miraba lowest_standard_ask — pero sneakerask tiene DOS
    // rankings de "mejor anuncio" (standard y express) con precios más
    // bajos distintos. Por defecto sugerimos contra el standard (el más
    // habitual), pero se puede cambiar abajo.
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

  const profit = costPrice && askPrice ? parseFloat(askPrice) - parseFloat(costPrice) : null;
  const floor = costPrice && minProfit ? parseFloat(costPrice) + parseFloat(minProfit) : null;

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
    if (!confirm("¿Dejar de trackear (y borrar el anuncio en sneakerask)?")) return;
    await fetch(`/api/listings/${id}`, { method: "DELETE" });
    loadTracked();
  }

  return (
    <main className="page">
      <p className="eyebrow">FastCop</p>
      <h1 className="page-title">Vigilante de sneakerask</h1>
      <p className="page-subtitle">
        Busca tu producto, crea el anuncio con tu coste y beneficio mínimo, y deja que el vigilante se
        encargue de mantenerte competitivo sin perder margen.
      </p>

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
          <div key={p.id} className="card-quiet" style={{ padding: 12, marginBottom: 10, borderRadius: 8 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              {p.image && <img src={p.image} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />}
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
                  {s.size} {s.listing_exists ? "✓" : ""}
                  {s.lowest_standard_ask ? ` · std ${s.lowest_standard_ask}€` : ""}
                  {s.lowest_express_ask ? ` · exp ${s.lowest_express_ask}€` : ""}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!searching && query && results.length === 0 && <p className="empty-state">Sin resultados.</p>}
      </div>

      {form && (
        <div className="fixed-modal" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setForm(null)}>
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
                style={targetAsk === "standard" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : { background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                Competir en Standard{form.size.lowest_standard_ask ? ` (${form.size.lowest_standard_ask}€)` : ""}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => suggestAskFor("express")}
                style={targetAsk === "express" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : { background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                Competir en Express{form.size.lowest_express_ask ? ` (${form.size.lowest_express_ask}€)` : ""}
              </button>
            </div>

            <label className="field" style={{ display: "block", marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
              Precio de coste (privado, solo lo ves tú)
              <input className="input" style={{ marginTop: 4 }} value={costPrice} onChange={(e) => setCostPrice(e.target.value)} type="number" />
            </label>
            <label className="field" style={{ display: "block", marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
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
              <p className="callout callout-info" style={{ fontSize: 13 }}>
                Beneficio con este precio: <strong>{profit.toFixed(2)}€</strong>
                {floor !== null && ` · Precio mínimo permitido: ${floor.toFixed(2)}€`}
              </p>
            )}
            {formError && <p className="callout callout-error">{formError}</p>}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveListing} disabled={saving}>
                {saving ? "Creando…" : "Crear anuncio y empezar a vigilar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="section-label">Tus anuncios vigilados ({tracked.length})</p>
      <div className="card">
        {tracked.length === 0 && <p className="empty-state">Ninguno todavía — busca un producto arriba para empezar.</p>}
        {tracked.map((t) => {
          const profitNow = t.ask_price - t.cost_price;
          return (
            <div
              key={t.id}
              className="row-between"
              style={{ borderBottom: "1px solid var(--border)", padding: "12px 0" }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {t.image && <img src={t.image} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />}
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 650 }}>
                    {t.title} — talla {t.size}
                    {t.last_is_best === true && <span className="badge" style={{ marginLeft: 6, background: "var(--success-soft)", color: "var(--success)" }}>Mejor anuncio</span>}
                    {t.last_is_best === false && <span className="badge" style={{ marginLeft: 6, background: "var(--danger-soft)", color: "var(--danger)" }}>Te han bajado</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                    Venta: {t.ask_price}€ · Coste: {t.cost_price}€ · Beneficio: {profitNow.toFixed(2)}€ · Mínimo: {(t.cost_price + t.min_profit).toFixed(2)}€ · Compite en {t.target_ask_type === "express" ? "Express" : "Standard"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => repriceNow(t.id)} disabled={repricingId !== null}>
                  {repricingId === t.id ? <span className="spinner" style={{ borderTopColor: "var(--accent)" }} /> : "Reajustar ahora"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => removeTracked(t.id)}>Dejar de vigilar</button>
              </div>
            </div>
          );
        })}
      </div>

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
