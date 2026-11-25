import { notFound } from 'next/navigation';
import { getBook, getContents, readChapter } from '../../../lib/db';
import Reader from '../../../components/reader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function generateMetadata({ params }: PageProps<'/read/[id]'>) {
  const { id } = await params;
  const book = getBook(id);
  return { title: book?.title ?? 'Livro não encontrado' };
}

export default async function ReadPage({ params }: PageProps<'/read/[id]'>) {
  const { id } = await params;
  const book = getBook(id);
  if (!book) notFound();
  const initial = readChapter(id, book.chapter);
  if (!initial) notFound();
  return <Reader book={book} initial={initial} contents={getContents(id)} />;
}
