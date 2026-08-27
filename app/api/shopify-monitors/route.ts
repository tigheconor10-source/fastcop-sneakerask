import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

function parseShopifyUrl(rawUrl: string) {
  const u = new URL(rawUrl);
  const domain = u.hostname.replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('products');
  const handle = idx !== -1 ? parts[idx + 1] : parts[parts.length - 1];
  return { domain, handle, cleanUrl: `${u.origin}${u.pathname}` };
}

export async function GET() {
  const db = getSupabase();
  const { data, error } = await db.from('shopify_monitors').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ monitors: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { url, label } = body;
  if (!url) return NextResponse.json({ error: 'Falta la URL' }, { status: 400 });
  const webhook = body.discordWebhookUrl || process.env.DEFAULT_DISCORD_WEBHOOK_URL;
  if (!webhook) return NextResponse.json({ error: 'Falta DEFAULT_DISCORD_WEBHOOK_URL' }, { status: 500 });

  const { domain, handle, cleanUrl } = parseShopifyUrl(url);
  if (!handle) return NextResponse.json({ error: 'No pude extraer el handle de esa URL de Shopify' }, { status: 400 });

  const db = getSupabase();
  const { data, error } = await db.from('shopify_monitors').insert({
    url: cleanUrl, store_domain: domain, product_handle: handle,
    discord_webhook_url: webhook, label: label || null, active: true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ monitor: data });
}
