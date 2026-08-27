import { checkShopifyProduct } from './shopify-monitor-check';

export async function checkAndNotifyShopify(db: any, monitor: any): Promise<{ changed: boolean; error?: string }> {
  const now = new Date().toISOString();
  let result;
  try {
    result = await checkShopifyProduct(monitor.store_domain, monitor.product_handle);
  } catch (err: any) {
    await db.from('shopify_monitors').update({ error: err.message, last_checked_at: now }).eq('id', monitor.id);
    return { changed: false, error: err.message };
  }

  const priceChanged = result.price && result.price !== monitor.last_price;
  const prevVariants = Array.isArray(monitor.last_variants) ? monitor.last_variants : [];
  const wasAnyAvailable = prevVariants.length === 0 ? null : prevVariants.some((v: any) => v.available);
  const restocked = wasAnyAvailable === false && result.anyAvailable === true;
  const soldOut = wasAnyAvailable === true && result.anyAvailable === false;
  const changed = Boolean(priceChanged || restocked || soldOut);

  await db.from('shopify_monitors').update({
    last_price: result.price ?? monitor.last_price,
    last_variants: result.variants,
    last_checked_at: now,
    error: null,
  }).eq('id', monitor.id);

  if (changed && monitor.discord_webhook_url) {
    const label = monitor.label || result.title || monitor.product_handle;
    let content = `🛍️ **${label}**\n${monitor.url}`;
    if (priceChanged) content += `\n\n💰 **Precio**: ${monitor.last_price ?? '?'} → **${result.price}**`;
    if (restocked) content += `\n\n✅ **Ha vuelto a haber stock**`;
    if (soldOut) content += `\n\n❌ **Se ha agotado**`;
    await fetch(monitor.discord_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).catch(() => {});
  }

  return { changed };
}
