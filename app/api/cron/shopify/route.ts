import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getSupabase } from '@/lib/supabase';
import { checkAndNotifyShopify } from '@/lib/shopify-check-notify';

export const maxDuration = 45;

// Cron de los "Monitores Shopify" — cron-job.org lo llama cada minuto.
// Lotes pequeños (los que llevan más tiempo sin comprobarse) + lock, para
// poder ir cada minuto sin que ningún tick tarde ni pese de más.
const BATCH_SIZE = 8;
const LOCK_MS = 25_000;

async function acquireLock(): Promise<boolean> {
  const now = new Date();
  const stale = new Date(now.getTime() - LOCK_MS).toISOString();
  const result = await sql`
    update cron_state
    set shopify_locked_at = ${now.toISOString()}
    where id = true
      and (shopify_locked_at is null or shopify_locked_at < ${stale})
    returning id
  `;
  return result.rows.length > 0;
}

async function releaseLock(): Promise<void> {
  await sql`update cron_state set shopify_locked_at = null where id = true`;
}

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const locked = await acquireLock();
  if (!locked) {
    return NextResponse.json({ skipped: true, reason: 'locked' });
  }

  try {
    const db = getSupabase();
    const { data: monitors } = await db
      .from('shopify_monitors')
      .select('*')
      .eq('active', true)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    let changed = 0, errors = 0;
    for (const m of monitors ?? []) {
      const r = await checkAndNotifyShopify(db, m);
      if (r.changed) changed++;
      if (r.error) errors++;
    }

    return NextResponse.json({ checked: (monitors ?? []).length, changed, errors });
  } finally {
    await releaseLock();
  }
}
