'use client';

import { useState, useEffect } from 'react';

// ── Iconos SVG inline (sin dependencias) ─────────────────────────────────────
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="11" cy="11" r="7.5" /><path d="m20 20-3.9-3.9" />
  </svg>
);
const MonitorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
  </svg>
);
const ShopifyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const ExternalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

type SearchResult = {
  title: string; url: string; displayUrl: string; snippet: string;
  price: number | null; currency: string;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  matchType: 'exact' | 'probable' | 'possible';
  confidence: number;
  priceAnomaly?: 'none' | 'below' | 'above';
  expectedRetail?: { min: number; max: number } | null;
};

type Monitor = {
  id: string; url: string; label?: string; active: boolean;
  last_price?: string; last_stock?: string; last_checked_at?: string;
  store_domain?: string; product_handle?: string;
  price_selector?: string; error?: string;
};

// ── Buscador ──────────────────────────────────────────────────────────────────
function SearchSection() {
  const [mode, setMode] = useState<'europe' | 'asia'>('europe');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchedAt, setSearchedAt] = useState('');
  const [asiaStatusMsg, setAsiaStatusMsg] = useState('');

  const searchEurope = async () => {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setResults(data.results ?? []);
    setSearchedAt(data.searchedAt);
  };

  // Búsqueda en Asia: no es instantánea — se manda a una cola que procesa
  // un cron cada minuto (mira sitios .jp .kr .hk .sg .tw .th), así que
  // aquí encolamos y hacemos polling hasta que esté lista.
  const searchAsia = async () => {
    setAsiaStatusMsg('En cola — el cron la recoge en menos de un minuto…');
    const queueRes = await fetch('/api/search-asia/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const queued = await queueRes.json();
    if (queued.error) throw new Error(queued.error);

    const id = queued.id;
    const maxAttempts = 40; // ~2 minutos de margen (cron cada minuto + procesado)
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(`/api/search-asia/queue?id=${id}`);
      const row = await pollRes.json();
      if (row.error && row.status !== 'error') throw new Error(row.error);

      if (row.status === 'done') {
        setResults((row.results ?? []).map((r: any) => ({ ...r, currency: r.currency ?? '' })));
        setSearchedAt(row.searched_at);
        setAsiaStatusMsg('');
        return;
      }
      if (row.status === 'error') {
        throw new Error(row.error || 'Error buscando en Asia');
      }
      setAsiaStatusMsg(row.status === 'processing' ? 'Buscando en tiendas asiáticas…' : 'En cola — el cron la recoge en menos de un minuto…');
    }
    throw new Error('Está tardando más de lo normal — vuelve a intentarlo en un momento.');
  };

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(''); setResults([]); setAsiaStatusMsg('');
    try {
      if (mode === 'asia') await searchAsia();
      else await searchEurope();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); setAsiaStatusMsg(''); }
  };

  const matchLabel: Record<string, string> = {
    exact: 'SKU encontrado', probable: 'Probable', possible: 'Posible',
  };

  return (
    <div>
      <h1 className="section-title">Buscar zapatilla</h1>
      <p className="section-sub">
        Escribe el SKU, nombre, colorway o cualquier referencia — buscamos en toda la web.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => setMode('europe')}
          className={`btn-open`}
          style={{ fontWeight: mode === 'europe' ? 700 : 400, opacity: mode === 'europe' ? 1 : 0.6 }}
        >
          Europa
        </button>
        <button
          type="button"
          onClick={() => setMode('asia')}
          className={`btn-open`}
          style={{ fontWeight: mode === 'asia' ? 700 : 400, opacity: mode === 'asia' ? 1 : 0.6 }}
        >
          Asia (.jp .kr .hk .sg .tw .th)
        </button>
      </div>

      <form onSubmit={search} className="search-box">
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej. L41685800  ·  Salomon XT-6  ·  Nike DD1391-100"
        />
        <button className="btn-primary" type="submit" disabled={loading || !query.trim()}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

      {loading && (
        <div className="loading">
          <div className="spinner" />
          {mode === 'asia' ? (asiaStatusMsg || 'Buscando en tiendas asiáticas…') : 'Buscando en toda la web…'}
        </div>
      )}


      {results.length > 0 && (
        <>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
            {results.length} resultados para <strong>"{query}"</strong>
            {searchedAt && ` · ${new Date(searchedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
          <div>
            {results.map((r, i) => (
              <div key={i} className="result-card">
                <div className="result-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="result-title">{r.title}</div>
                    <div className="result-url">{r.displayUrl}</div>
                  </div>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn-open">
                    Abrir <ExternalIcon />
                  </a>
                </div>
                <div className="result-snippet">{r.snippet}</div>
                <div className="result-meta">
                  <span className={`match-badge match-${r.matchType}`}>
                    {matchLabel[r.matchType]}
                  </span>
                  {r.price !== null ? (
                    <span className="price">€{r.price.toFixed(2)}</span>
                  ) : (
                    <span className="price-unknown">Precio no extraído</span>
                  )}
                  <span className={`avail-badge avail-${r.availability}`}>
                    {r.availability === 'in_stock' ? 'En stock' :
                     r.availability === 'out_of_stock' ? 'Sin stock' : 'Stock no verificado'}
                  </span>
                  {r.priceAnomaly === 'above' && r.expectedRetail && (
                    <span className="match-badge match-probable" title={`Retail habitual: €${r.expectedRetail.min}–€${r.expectedRetail.max}`}>
                      ⚠ Por encima del retail
                    </span>
                  )}
                  {r.priceAnomaly === 'below' && r.expectedRetail && (
                    <span className="match-badge match-probable" title={`Retail habitual: €${r.expectedRetail.min}–€${r.expectedRetail.max}`}>
                      ⚠ Precio sospechosamente bajo
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && results.length === 0 && query && !error && (
        <div className="empty">No se encontraron resultados para "{query}"</div>
      )}
    </div>
  );
}

// ── Monitores web ─────────────────────────────────────────────────────────────
function WebMonitorsSection() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [selector, setSelector] = useState('.current-price');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/web-monitors');
      const d = await r.json();
      setMonitors(d.monitors ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setOk(''); setSaving(true);
    try {
      const r = await fetch('/api/web-monitors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, label, priceSelector: selector }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setOk('Monitor añadido. Dale a "Check" para hacer la primera comprobación.');
      setUrl(''); setLabel(''); setSelector('.current-price');
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const checkNow = async (m: Monitor) => {
    setChecking((c) => ({ ...c, [m.id]: true }));
    try {
      const r = await fetch(`/api/web-monitors/${m.id}/check`, { method: 'POST' });
      const d = await r.json();
      if (d.error) alert(`Error: ${d.error}`);
      else alert(d.changed ? `Cambio detectado!\nPrecio: ${d.price}` : `Sin cambios.\nPrecio: ${d.price ?? '—'}`);
    } finally {
      setChecking((c) => ({ ...c, [m.id]: false }));
      load();
    }
  };

  const toggle = async (m: Monitor) => {
    await fetch(`/api/web-monitors/${m.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !m.active }),
    });
    load();
  };

  const remove = async (m: Monitor) => {
    if (!confirm(`¿Borrar "${m.label || m.url}"?`)) return;
    await fetch(`/api/web-monitors/${m.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div>
      <h1 className="section-title">Monitores web</h1>
      <p className="section-sub">PrestaShop, WooCommerce y cualquier tienda — aviso a Discord si cambia el precio o el stock.</p>

      <form onSubmit={add} className="monitor-form">
        <div>
          <label className="field-label">URL del producto</label>
          <input required className="field-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://galiforniashop.com/es/.../producto.html" />
        </div>
        <div>
          <label className="field-label">Etiqueta (opcional)</label>
          <input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Samba OG Blanca 42" />
        </div>
        <div>
          <label className="field-label">Selector CSS del precio (PrestaShop: <code>.current-price</code>)</label>
          <input className="field-input" value={selector} onChange={(e) => setSelector(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12 }} />
        </div>
        <button className="btn-add" type="submit" disabled={saving}>{saving ? 'Guardando…' : '+ Añadir monitor'}</button>
        {err && <div className="error-msg">{err}</div>}
        {ok && <div className="success-msg">{ok}</div>}
      </form>

      {loading ? <div className="loading"><div className="spinner" /> Cargando…</div> : (
        <div>
          {monitors.map((m) => (
            <div key={m.id} className="monitor-row" style={{ opacity: m.active ? 1 : .45 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="monitor-label">{m.label || new URL(m.url).hostname}</div>
                <div className="monitor-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.url}</div>
                {m.last_price && <div className="monitor-price">{m.last_price}</div>}
                {m.error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>⚠ {m.error}</div>}
                {m.last_checked_at && <div className="monitor-meta" style={{ marginTop: 4 }}>Último check: {new Date(m.last_checked_at).toLocaleString('es-ES')}</div>}
              </div>
              <div className="actions">
                <button className="btn-sm btn-check" onClick={() => checkNow(m)} disabled={checking[m.id]}>{checking[m.id] ? '…' : 'Check'}</button>
                <button className="btn-sm" onClick={() => toggle(m)}>{m.active ? 'Pausar' : 'Activar'}</button>
                <button className="btn-sm btn-delete" onClick={() => remove(m)}>Borrar</button>
              </div>
            </div>
          ))}
          {monitors.length === 0 && <div className="empty">Ningún monitor todavía.</div>}
        </div>
      )}
    </div>
  );
}

// ── Monitores Shopify ─────────────────────────────────────────────────────────
function ShopifyMonitorsSection() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/shopify-monitors');
      const d = await r.json();
      setMonitors(d.monitors ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setOk(''); setSaving(true);
    try {
      const r = await fetch('/api/shopify-monitors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, label }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setOk(`Añadido: ${d.monitor.store_domain} — ${d.monitor.product_handle}`);
      setUrl(''); setLabel(''); load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (m: Monitor) => {
    await fetch(`/api/shopify-monitors/${m.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !m.active }),
    });
    load();
  };

  const remove = async (m: Monitor) => {
    if (!confirm(`¿Borrar "${m.label || m.product_handle}"?`)) return;
    await fetch(`/api/shopify-monitors/${m.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div>
      <h1 className="section-title">Monitores Shopify</h1>
      <p className="section-sub">Pega el link de cualquier producto en una tienda Shopify.</p>

      <form onSubmit={add} className="monitor-form">
        <div>
          <label className="field-label">URL del producto (tienda Shopify)</label>
          <input required className="field-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tienda.myshopify.com/products/samba-og-blanca" />
        </div>
        <div>
          <label className="field-label">Etiqueta (opcional)</label>
          <input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Samba OG Blanca" />
        </div>
        <button className="btn-add" type="submit" disabled={saving}>{saving ? 'Guardando…' : '+ Añadir monitor'}</button>
        {err && <div className="error-msg">{err}</div>}
        {ok && <div className="success-msg">{ok}</div>}
      </form>

      {loading ? <div className="loading"><div className="spinner" /> Cargando…</div> : (
        <div>
          {monitors.map((m) => (
            <div key={m.id} className="monitor-row" style={{ opacity: m.active ? 1 : .45 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="monitor-label">{m.label || m.product_handle}</div>
                <div className="monitor-meta">{m.store_domain}</div>
                {m.last_price && <div className="monitor-price">{m.last_price}</div>}
                {m.last_checked_at && <div className="monitor-meta" style={{ marginTop: 4 }}>Último check: {new Date(m.last_checked_at).toLocaleString('es-ES')}</div>}
              </div>
              <div className="actions">
                <button className="btn-sm" onClick={() => toggle(m)}>{m.active ? 'Pausar' : 'Activar'}</button>
                <button className="btn-sm btn-delete" onClick={() => remove(m)}>Borrar</button>
              </div>
            </div>
          ))}
          {monitors.length === 0 && <div className="empty">Ningún monitor todavía.</div>}
        </div>
      )}
    </div>
  );
}

// ── App principal ─────────────────────────────────────────────────────────────
type Section = 'search' | 'web-monitors' | 'shopify-monitors';

export default function App() {
  const [section, setSection] = useState<Section>('search');

  const navItems: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'search', label: 'Buscar', icon: <SearchIcon /> },
    { id: 'web-monitors', label: 'Monitores web', icon: <MonitorIcon /> },
    { id: 'shopify-monitors', label: 'Monitores Shopify', icon: <ShopifyIcon /> },
  ];

  return (
    <div className="shell">
      <nav className="sidebar">
        <a className="logo" href="/">Fastcop.</a>
        {navItems.map((n) => (
          <button
            key={n.id}
            className={`nav-item ${section === n.id ? 'active' : ''}`}
            onClick={() => setSection(n.id)}
          >
            {n.icon}
            {n.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {section === 'search' && <SearchSection />}
        {section === 'web-monitors' && <WebMonitorsSection />}
        {section === 'shopify-monitors' && <ShopifyMonitorsSection />}
      </main>
    </div>
  );
}
