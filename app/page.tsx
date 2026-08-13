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

// Un item de la "cesta": una talla concreta de un producto, con su precio
// de coste/beneficio/venta editables antes de crearla de verdad.
type CartItem = {
  key: string; // `${productId}__${size}`
  productId: number;
  sku: string;
  title: string;
  image: string | null;
  brand: string;
  size: string;
  lowestStandardAsk: number | null;
  costPrice: string;
  minProfit: string;
  askPrice: string;
  quantity: string;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchBy, setSearchBy] = useState<"auto" | "sku" | "title" | "brand">("auto");
  const [results, setResults] = useState<SneakeraskProduct[]>([]);
  const [searching, setSearching] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [creatingCart, setCreatingCart] = useState(false);
  const [cartError, setCartError] = useState("");

  const [tracked, setTracked] = useState<TrackedListing[]>([]);
  const [repricingId, setRepricingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAskPrice, setEditAskPrice] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
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
      const res = await fetch(`/api/sneakerask/search?q=${encodeURIComponent(query)}&by=${searchBy}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.items || []);
    } catch (e: any) {
      append("ERROR buscando: " + e.message);
    } finally {
      setSearching(false);
    }
  }

  function toggleCartItem(product: SneakeraskProduct, size: SneakeraskSize) {
    const key = `${product.id}__${size.size}`;
    setCart((prev) => {
      const already = prev.find((c) => c.key === key);
      if (already) return prev.filter((c) => c.key !== key);
      const suggestedAsk = size.lowest_standard_ask ? Math.max(1, size.lowest_standard_ask - 1) : 0;
      return [
        ...prev,
        {
          key,
          productId: product.id,
          sku: product.sku,
          title: product.title,
          image: product.image,
          brand: product.brand,
          size: size.size,
          lowestStandardAsk: size.lowest_standard_ask,
          costPrice: "",
          minProfit: "20",
          askPrice: suggestedAsk ? String(suggestedAsk) : "",
          quantity: "1",
        },
      ];
    });
  }

  function updateCartItem(key: string, field: keyof CartItem, value: string) {
    setCart((prev) => prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)));
  }

  function removeCartItem(key: string) {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }

  async function createCart() {
    setCartError("");
    const incomplete = cart.filter((c) => !c.costPrice || !c.askPrice);
    if (incomplete.length > 0) {
      setCartError(`Faltan precios en ${incomplete.length} talla(s) de la cesta — rellénalos antes de crear.`);
      return;
    }
    setCreatingCart(true);
    try {
      const res = await fetch("/api/listings/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((c) => ({
            sneakeraskProductId: c.productId,
            sku: c.sku,
            title: c.title,
            image: c.image,
            brand: c.brand,
            size: c.size,
            costPrice: parseFloat(c.costPrice),
            minProfit: parseFloat(c.minProfit) || 0,
            askPrice: parseFloat(c.askPrice),
            quantity: parseInt(c.quantity, 10) || 1,
          })),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      append(
        `✓ Cesta creada: ${data.sneakeraskResult.created_count} nuevos, ${data.sneakeraskResult.updated_count} actualizados` +
          (data.sneakeraskResult.skipped_count ? `, ${data.sneakeraskResult.skipped_count} saltados` : "")
      );
      setCart([]);
      loadTracked();
    } catch (e: any) {
      setCartError(e.message);
    } finally {
      setCreatingCart(false);
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

  function startEdit(t: TrackedListing) {
    setEditingId(t.id);
    setEditAskPrice(String(t.ask_price));
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ askPrice: parseFloat(editAskPrice) }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      append(`✓ Precio actualizado en sneakerask a ${editAskPrice}€`);
      setEditingId(null);
      loadTracked();
    } catch (e: any) {
      append("ERROR actualizando precio: " + e.message);
    } finally {
      setSavingEdit(false);
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
        Busca tus productos, marca las tallas que quieras (una o varias), ponles coste y
        beneficio mínimo, y crea todo de golpe. El vigilante se encarga de mantenerte
        competitivo sin perder margen.
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
            style={{ flex: 1 }}
          />
          <select
            className="input"
            value={searchBy}
            onChange={(e) => setSearchBy(e.target.value as any)}
            style={{ width: 110 }}
            title="Modo de búsqueda — usa SKU si sabes el SKU exacto, es más rápido"
          >
            <option value="auto">Auto</option>
            <option value="sku">SKU</option>
            <option value="title">Título</option>
            <option value="brand">Marca</option>
          </select>
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
              {p.sizes.map((s) => {
                const key = `${p.id}__${s.size}`;
                const inCart = cart.some((c) => c.key === key);
                return (
                  <button
                    key={s.size}
                    onClick={() => toggleCartItem(p, s)}
                    className="btn btn-secondary btn-sm"
                    style={inCart ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : undefined}
                    title={`Lowest std: ${s.lowest_standard_ask ?? "-"}€ · express: ${s.lowest_express_ask ?? "-"}€`}
                  >
                    {inCart ? "✓ " : ""}
                    {s.size} {s.listing_exists ? "· ya tienes anuncio" : ""} {s.lowest_standard_ask ? `· ${s.lowest_standard_ask}€` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!searching && query && results.length === 0 && <p className="empty-state">Sin resultados.</p>}
      </div>

      {cart.length > 0 && (
        <>
          <p className="section-label">Cesta — tallas a crear ({cart.length})</p>
          <div className="card">
            {cart.map((c) => {
              const profit = c.costPrice && c.askPrice ? parseFloat(c.askPrice) - parseFloat(c.costPrice) : null;
              const floor = c.costPrice && c.minProfit ? parseFloat(c.costPrice) + parseFloat(c.minProfit) : null;
              return (
                <div key={c.key} className="card-quiet" style={{ padding: 12, marginBottom: 10, borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {c.image && <img src={c.image} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6 }} />}
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {c.title} — talla {c.size}
                        {c.lowestStandardAsk != null && (
                          <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}> · mínimo actual: {c.lowestStandardAsk}€</span>
                        )}
                      </div>
                    </div>
                    <button className="icon-btn" onClick={() => removeCartItem(c.key)}>✕</button>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <label style={{ fontSize: 12 }}>
                      Coste (€)
                      <input
                        className="input"
                        style={{ width: 90, marginTop: 2 }}
                        type="number"
                        value={c.costPrice}
                        onChange={(e) => updateCartItem(c.key, "costPrice", e.target.value)}
                      />
                    </label>
                    <label style={{ fontSize: 12 }}>
                      Beneficio mín. (€)
                      <input
                        className="input"
                        style={{ width: 90, marginTop: 2 }}
                        type="number"
                        value={c.minProfit}
                        onChange={(e) => updateCartItem(c.key, "minProfit", e.target.value)}
                      />
                    </label>
                    <label style={{ fontSize: 12 }}>
                      Precio venta (€)
                      <input
                        className="input"
                        style={{ width: 90, marginTop: 2 }}
                        type="number"
                        value={c.askPrice}
                        onChange={(e) => updateCartItem(c.key, "askPrice", e.target.value)}
                      />
                    </label>
                    <label style={{ fontSize: 12 }}>
                      Cantidad
                      <input
                        className="input"
                        style={{ width: 70, marginTop: 2 }}
                        type="number"
                        value={c.quantity}
                        onChange={(e) => updateCartItem(c.key, "quantity", e.target.value)}
                      />
                    </label>
                  </div>
                  {profit !== null && (
                    <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 6 }}>
                      Beneficio: <strong>{profit.toFixed(2)}€</strong>
                      {floor !== null && ` · mínimo permitido: ${floor.toFixed(2)}€`}
                      {floor !== null && profit < parseFloat(c.minProfit || "0") && (
                        <span style={{ color: "var(--danger)" }}> ⚠ por debajo de tu beneficio mínimo</span>
                      )}
                    </p>
                  )}
                </div>
              );
            })}

            {cartError && <p className="callout callout-error">{cartError}</p>}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setCart([])}>Vaciar cesta</button>
              <button className="btn btn-primary" onClick={createCart} disabled={creatingCart}>
                {creatingCart ? "Creando…" : `Crear ${cart.length} anuncio(s) en sneakerask`}
              </button>
            </div>
          </div>
        </>
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
                  {editingId === t.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                      <input
                        className="input"
                        style={{ width: 90 }}
                        type="number"
                        value={editAskPrice}
                        onChange={(e) => setEditAskPrice(e.target.value)}
                        autoFocus
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(t.id)} disabled={savingEdit}>
                        {savingEdit ? "…" : "Guardar"}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                      Venta: {t.ask_price}€ · Coste: {t.cost_price}€ · Beneficio: {profitNow.toFixed(2)}€ · Mínimo: {(t.cost_price + t.min_profit).toFixed(2)}€
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {editingId !== t.id && (
                  <button className="btn btn-secondary btn-sm" onClick={() => startEdit(t)}>Editar precio</button>
                )}
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
