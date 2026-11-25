import { addBook, listBooks, updateBook } from '../../../lib/db';
import { catalogLink, ImportError, MAX_FILE_SIZE, parseBook } from '../../../lib/import-book';
import { isLevel } from '../../../lib/levels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(listBooks());
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && URL.parse(origin)?.host !== request.headers.get('host')) {
    return Response.json({ error: 'Origem inválida.' }, { status: 403 });
  }
  if (Number(request.headers.get('content-length')) > MAX_FILE_SIZE + 65536) {
    return Response.json({ error: 'O limite por arquivo é de 25 MB.' }, { status: 413 });
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'Arquivo de importação inválido.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File) || !/\.(epub|txt)$/i.test(file.name)) {
    return Response.json({ error: 'Selecione um arquivo EPUB ou TXT.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: 'O limite por arquivo é de 25 MB.' }, { status: 413 });
  }
  try {
    const source = catalogLink(form.get('source'));
    const level = form.get('level');
    if (level !== null && level !== '' && !isLevel(level)) throw new ImportError('Selecione um nível válido.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = addBook(bytes, (content, id) => {
      const parsed = parseBook(content, id, file.name, source);
      return isLevel(level) ? { ...parsed, level } : parsed;
    }, source);
    if (result.duplicate && isLevel(level)) {
      const book = updateBook(result.book.id, { level });
      if (book) return Response.json({ ...result, book });
    }
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof ImportError) return Response.json({ error: error.message }, { status: 422 });
    console.error(error);
    return Response.json({ error: 'Não foi possível salvar o livro.' }, { status: 500 });
  }
}
