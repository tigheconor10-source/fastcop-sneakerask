import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { runAsiaSearch } from '@/lib/asia-search';

export const maxDuration = 10;

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const claimResult = await sql`
    update asia_search_queue
    set status = 'processing', updated_at = now()
    where id = (
      select id from asia_search_queue
      where status = 'pending'
      order by created_at asc
      limit 1
      for update skip locked
    )
    returning id, query
  `;

  const claimed = claimResult.rows[0];
  if (!claimed) {
    return NextResponse.json({ processed: false, message: 'Nada pendiente' });
  }

  try {
    const results = await runAsiaSearch(claimed.query);
    await sql`
      update asia_search_queue
      set status = 'done', results = ${JSON.stringify(results)}::jsonb, searched_at = now(), updated_at = now()
      where id = ${claimed.id}
    `;

    return NextResponse.json({ processed: true, id: claimed.id, resultCount: results.length });
  } catch (err: any) {
    await sql`
      update asia_search_queue
      set status = 'error', error = ${err.message ?? 'Error desconocido'}, updated_at = now()
      where id = ${claimed.id}
    `;

    return NextResponse.json({ processed: false, id: claimed.id, error: err.message }, { status: 500 });
  }
}
