import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET() {
  const db = getSupabase();
  const { data, error } = await db.from('web_monitors').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ monitors: data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { url, label, priceSelector } = body;
  if (!url) return NextResponse.json({ error: 'Falta la URL' }, { status: 400 });
  const webhook = body.discordWebhookUrl || process.env.DEFAULT_DISCORD_WEBHOOK_URL;
  if (!webhook) return NextResponse.json({ error: 'Falta DEFAULT_DISCORD_WEBHOOK_URL' }, { status: 500 });
  const db = getSupabase();
  const { data, error } = await db.from('web_monitors').insert({
    url: url.trim(), label: label?.trim() || null,
    price_selector: priceSelector?.trim() || '.current-price',
    discord_webhook_url: webhook, active: true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ monitor: data });
}
