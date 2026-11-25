import { getBook, readChapter } from '@/lib/db';
import { BOOK_CONTEXT_CHARACTERS, getSurroundingText } from '@/features/translation/server/chapter-context';
import { suggestImpersonalDate } from '@/features/translation/server/grammar-suggestion';
import { TranslationError } from '@/features/translation/server/ollama';
import { translateSelection } from '@/features/translation/server/translate-selection';
import type { PassageAnchor, TranslationRequest } from '@/features/translation/types';

export const runtime = 'nodejs';

function isAnchor(value: unknown): value is PassageAnchor {
  if (!value || typeof value !== 'object') return false;
  const anchor = value as Partial<PassageAnchor>;
  return typeof anchor.text === 'string' && anchor.text.length <= 500 &&
    typeof anchor.before === 'string' && anchor.before.length <= 160 &&
    typeof anchor.after === 'string' && anchor.after.length <= 160;
}

function isTranslationRequest(value: unknown): value is TranslationRequest {
  if (!value || typeof value !== 'object') return false;
  const input = value as Partial<TranslationRequest>;
  return typeof input.text === 'string' && input.text.trim().length > 0 && input.text.length <= 500 &&
    typeof input.bookId === 'string' && input.bookId.length <= 100 &&
    typeof input.chapter === 'number' && Number.isSafeInteger(input.chapter) && input.chapter >= 0 &&
    (input.anchor === undefined || isAnchor(input.anchor));
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && URL.parse(origin)?.host !== request.headers.get('host')) {
    return Response.json({ error: 'Origem inválida.' }, { status: 403 });
  }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return Response.json({ error: 'Formato de requisição inválido.' }, { status: 415 });
  }

  const input: unknown = await request.json().catch(() => null);
  if (!isTranslationRequest(input)) {
    return Response.json({ error: 'Selecione ou digite até 500 caracteres para traduzir.' }, { status: 400 });
  }
  const book = getBook(input.bookId);
  const chapter = book && readChapter(book.id, input.chapter);
  if (!book || !chapter) return Response.json({ error: 'Capítulo indisponível.' }, { status: 404 });

  const selected = input.text.replace(/\s+/g, ' ').trim();
  const { before, after } = getSurroundingText(chapter.html, selected, input.anchor, BOOK_CONTEXT_CHARACTERS);
  const grammarSuggestion = suggestImpersonalDate(selected, after);
  if (grammarSuggestion) return Response.json(grammarSuggestion);
  try {
    const result = await translateSelection({ bookTitle: book.title, chapterTitle: chapter.title, before, selected, after }, request.signal);
    return Response.json(result);
  } catch (error) {
    if (error instanceof TranslationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
