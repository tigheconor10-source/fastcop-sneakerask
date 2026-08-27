import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { checkAndNotify } from '@/lib/check-notify';

export const maxDuration = 30;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getSupabase();
  const { data: monitor } = await db.from('web_monitors').select('*').eq('id', id).maybeSingle();
  if (!monitor) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return checkAndNotify(db, monitor, true);
}
