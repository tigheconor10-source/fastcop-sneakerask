import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = (body.query ?? '').trim();
    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Escribe al menos 2 caracteres' }, { status: 400 });
    }

    const result = await sql`
      insert into asia_search_queue (query)
      values (${query})
      returning id
    `;

    return NextResponse.json({ id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    const result = await sql`
      select id, query, status, results, searched_at, error
      from asia_search_queue
      where id = ${id}
    `;

    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
