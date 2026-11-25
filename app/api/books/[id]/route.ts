import { removeBook, updateBook } from '../../../../lib/db';
import type { BookChanges } from '../../../../lib/types';
import { isLevel } from '../../../../lib/levels';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: RouteContext<'/api/books/[id]'>) {
  const { id } = await params;
  const change: BookChanges | null = await request.json().catch(() => null);
  if (!change || typeof change !== 'object' ||
      (change.level !== undefined && change.level !== null && !isLevel(change.level)) ||
      (change.level === undefined && typeof change.favorite !== 'boolean' && !Number.isInteger(change.chapter))) {
    return Response.json({ error: 'Atualização inválida.' }, { status: 400 });
  }
  const book = updateBook(id, change);
  return book ? Response.json(book) : Response.json({ error: 'Livro não encontrado.' }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: RouteContext<'/api/books/[id]'>) {
  const { id } = await params;
  return new Response(null, { status: removeBook(id) ? 204 : 404 });
}
