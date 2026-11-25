import { readChapter } from '../../../../../../lib/db';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: RouteContext<'/api/books/[id]/chapters/[number]'>) {
  const { id, number } = await params;
  const chapter = /^\d+$/.test(number) && readChapter(id, Number(number));
  return chapter ? Response.json(chapter) : Response.json({ error: 'Capítulo não encontrado.' }, { status: 404 });
}
