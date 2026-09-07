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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [tracked, setTracked] = useState<TrackedListing[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "best" | "beaten" | "unchecked">("all");
  const [repricingId, setRepricingId] = useState<string | null>(null);
  const [log, setLog] = useState("");

  function append(text: string) {
    setLog((prev) => (prev ? prev + "\n" : "") + text);
  }

  async function loadTracked() {
    const res = await fetch("/api/listings");
    const data = await res.json();
    setTracked(data.listings || []);
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
    setAskPrice(size.lowest_standard_ask ? String(Math.max(1, size.lowest_standard_ask - 1)) : "");
    setQuantity("1");
    setFormError("");
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
                  {s.size} {s.listing_exists ? "✓" : ""} {s.lowest_standard_ask ? `· ${s.lowest_standard_ask}€` : ""}
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

      {tracked.length > 0 && (() => {
        const best = tracked.filter((t) => t.last_is_best === true).length;
        const beaten = tracked.filter((t) => t.last_is_best === false).length;
        const unchecked = tracked.filter((t) => t.last_is_best === null).length;
        const stats: { key: "all" | "best" | "beaten" | "unchecked"; label: string; count: number; color: string; bg: string }[] = [
          { key: "all", label: "Todos", count: tracked.length, color: "var(--ink)", bg: "var(--neutral-soft)" },
          { key: "best", label: "Mejor precio", count: best, color: "var(--success)", bg: "var(--success-soft)" },
          { key: "beaten", label: "Te han bajado", count: beaten, color: "var(--danger)", bg: "var(--danger-soft)" },
          { key: "unchecked", label: "Sin comprobar", count: unchecked, color: "var(--ink-faint)", bg: "var(--neutral-soft)" },
        ];
        return (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {stats.map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999,
                  border: statusFilter === s.key ? `1.5px solid ${s.color}` : "1px solid var(--border)",
                  background: statusFilter === s.key ? s.bg : "var(--surface)",
                  cursor: "pointer", fontSize: 13, fontWeight: 600, color: statusFilter === s.key ? s.color : "var(--ink-soft)",
                  transition: "all .12s ease",
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                {s.label}
                <span style={{ opacity: 0.6, fontWeight: 650 }}>{s.count}</span>
              </button>
            ))}
          </div>
        );
      })()}

      <div style={{ display: "grid", gap: 12 }}>
        {tracked.length === 0 && (
          <div className="card">
            <p className="empty-state">Ninguno todavía — busca un producto arriba para empezar.</p>
          </div>
        )}
        {tracked
          .filter((t) => {
            if (statusFilter === "best") return t.last_is_best === true;
            if (statusFilter === "beaten") return t.last_is_best === false;
            if (statusFilter === "unchecked") return t.last_is_best === null;
            return true;
          })
          .map((t) => {
            const profitNow = t.ask_price - t.cost_price;
            const floorPrice = t.cost_price + t.min_profit;
            // Posición de "Venta" en la barra entre Coste (0%) y un techo
            // visual holgado por encima del mínimo, para que se note de
            // un vistazo cuánto margen de sobra tienes ahora mismo.
            const ceiling = Math.max(floorPrice * 1.35, t.ask_price * 1.05, 1);
            const pct = (val: number) => Math.max(0, Math.min(100, (val / ceiling) * 100));

            const statusInfo =
              t.last_is_best === true
                ? { label: "Mejor precio", color: "var(--success)", bg: "var(--success-soft)", icon: "✓" }
                : t.last_is_best === false
                ? { label: "Te han bajado", color: "var(--danger)", bg: "var(--danger-soft)", icon: "!" }
                : { label: "Sin comprobar todavía", color: "var(--ink-faint)", bg: "var(--neutral-soft)", icon: "?" };

            const tight = profitNow <= t.min_profit; // margen ya en el mínimo o por debajo

            return (
              <div
                key={t.id}
                className="card"
                style={{ borderLeft: `3px solid ${statusInfo.color}`, display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
                    {t.image && (
                      <img src={t.image} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flex: "0 0 auto" }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 650, lineHeight: 1.3 }}>
                        {t.title}
                        <span style={{ color: "var(--ink-faint)", fontWeight: 500 }}> — talla {t.size}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 2 }}>
                        {t.sku}
                        {t.last_checked_at && ` · comprobado ${new Date(t.last_checked_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999,
                      background: statusInfo.bg, color: statusInfo.color, fontSize: 12, fontWeight: 650, flex: "0 0 auto", height: "fit-content",
                    }}
                  >
                    <span style={{ fontSize: 11 }}>{statusInfo.icon}</span> {statusInfo.label}
                  </span>
                </div>

                {/* Barra visual: dónde cae tu precio de venta respecto al coste y tu mínimo */}
                <div>
                  <div style={{ position: "relative", height: 8, borderRadius: 999, background: "var(--neutral-soft)", overflow: "hidden" }}>
                    <div
                      style={{
                        position: "absolute", left: 0, top: 0, height: "100%",
                        width: `${pct(t.ask_price)}%`,
                        background: tight ? "var(--danger)" : "var(--accent)",
                        borderRadius: 999, transition: "width .2s ease",
                      }}
                    />
                    <div
                      title={`Tu mínimo: ${floorPrice.toFixed(2)}€`}
                      style={{ position: "absolute", top: -2, bottom: -2, width: 2, background: "var(--ink)", opacity: 0.35, left: `${pct(floorPrice)}%` }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--ink-faint)", marginTop: 4 }}>
                    <span>Coste {t.cost_price.toFixed(2)}€</span>
                    <span>Tu mínimo {floorPrice.toFixed(2)}€</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[
                    { label: "Venta", value: `${t.ask_price.toFixed(2)}€` },
                    { label: "Coste", value: `${t.cost_price.toFixed(2)}€` },
                    { label: "Beneficio", value: `${profitNow.toFixed(2)}€`, warn: tight },
                    { label: "Mínimo", value: `${floorPrice.toFixed(2)}€` },
                  ].map((stat) => (
                    <div key={stat.label} style={{ background: "var(--bg)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10.5, color: "var(--ink-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em" }}>{stat.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: stat.warn ? "var(--danger)" : "var(--ink)", marginTop: 2 }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => repriceNow(t.id)} disabled={repricingId !== null} style={{ flex: 1 }}>
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
