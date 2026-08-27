import { scrapeMonitorUrl } from './monitor-scraper';

export async function checkAndNotify(db: any, monitor: any, forceNotify = false) {
  const { NextResponse } = await import('next/server');
  let scraped: any;
  try {
    scraped = await scrapeMonitorUrl(monitor.url, monitor.price_selector, monitor.stock_selector);
  } catch (err: any) {
    await db.from('web_monitors').update({ error: err.message, last_checked_at: new Date().toISOString() }).eq('id', monitor.id);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const priceChanged = scraped.price && scraped.price !== monitor.last_price;
  const stockChanged = scraped.stock && scraped.stock !== monitor.last_stock;
  const changed = priceChanged || stockChanged;

  await db.from('web_monitors').update({
    last_price: scraped.price ?? monitor.last_price,
    last_stock: scraped.stock ?? monitor.last_stock,
    last_checked_at: now,
    last_changed_at: changed ? now : monitor.last_changed_at,
    error: null,
  }).eq('id', monitor.id);

  if ((changed || forceNotify) && monitor.discord_webhook_url) {
    const label = monitor.label || scraped.name || monitor.url;
    let content = `🔍 **${label}**\n${monitor.url}`;
    if (forceNotify && !changed) {
      content += `\n\nSin cambios. Precio: **${scraped.price ?? '—'}**`;
    } else {
      if (priceChanged) content += `\n\n💰 **Precio**: ${monitor.last_price ?? '?'} → **${scraped.price}**`;
      if (stockChanged) content += `\n\n${scraped.stock?.includes('out') ? '❌' : '✅'} **Stock**: → **${scraped.stock}**`;
    }
    await fetch(monitor.discord_webhook_url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).catch(() => {});
  }

  return (await import('next/server')).NextResponse.json({ ok: true, changed, price: scraped.price, stock: scraped.stock, method: scraped.method });
}
