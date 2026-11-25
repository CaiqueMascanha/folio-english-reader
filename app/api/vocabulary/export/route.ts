import { listVocabulary } from '@/lib/db';
import { exportVocabulary } from '@/lib/vocabulary-export';

export const runtime = 'nodejs';

export function GET(request: Request) {
  const format = new URL(request.url).searchParams.get('format') || 'csv';
  const download = exportVocabulary(listVocabulary(), format);
  if (!download) return Response.json({ error: 'Formato inválido.' }, { status: 400 });
  const suffix = ['noji', 'anki', 'flashcards'].includes(format) ? `-${format}` : '';
  return new Response(download.body, { headers: {
    'Cache-Control': 'no-store',
    'Content-Type': download.mime + (typeof download.body === 'string' ? '; charset=utf-8' : ''),
    'Content-Disposition': `attachment; filename="folio-vocabulario${suffix}.${download.extension}"`,
  } });
}
