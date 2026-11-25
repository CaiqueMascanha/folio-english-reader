import { editVocabulary, saveVocabulary } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const data = await request.json().catch(() => null);
  if (!data || typeof data.bookId !== 'string' || !Number.isInteger(data.chapter) ||
      typeof data.text !== 'string' || !data.text.trim() || data.text.length > 500 ||
      typeof data.meaning !== 'string' || data.meaning.length > 1000 ||
      typeof data.context !== 'string' || data.context.length > 1000) {
    return Response.json({ error: 'Confira o trecho e os limites dos campos.' }, { status: 400 });
  }
  const saved = saveVocabulary({ text: data.text.trim(), meaning: data.meaning.trim(), context: data.context.trim() }, data.bookId, data.chapter);
  return saved ? Response.json(saved, { status: 201 }) : Response.json({ error: 'Capítulo indisponível.' }, { status: 404 });
}

export async function PATCH(request: Request) {
  const data = await request.json().catch(() => null);
  if (!data || typeof data.id !== 'string' || typeof data.meaning !== 'string' || data.meaning.length > 1000) {
    return Response.json({ error: 'Significado inválido.' }, { status: 400 });
  }
  return new Response(null, { status: editVocabulary(data.id, data.meaning.trim()) ? 204 : 404 });
}
