import type { DatabaseSync } from 'node:sqlite';
import { catalogLevel, matchesCatalogLink, referencesEnglishReader } from './english-reader-catalog';

// Older imports retain chapter text and the optional catalogue URL, but not the OPF.
// Run once so a reader can subsequently clear or override the level.
export function repairEpubLevels(database: DatabaseSync) {
  const migration = 'english-reader-epub-levels-v1';
  if (database.prepare('SELECT 1 FROM settings WHERE name = ?').get(migration)) return;

  const books = database.prepare("SELECT id, title, author, source FROM books WHERE format = 'EPUB' AND level IS NULL").all() as {
    id: string; title: string; author: string; source: string | null;
  }[];
  const chapterReferences = database.prepare("SELECT html FROM chapters WHERE book_id = ? AND instr(lower(html), 'english-e-') > 0");
  const save = database.prepare('UPDATE books SET level = ? WHERE id = ? AND level IS NULL');
  for (const book of books) {
    const level = catalogLevel(book.title, book.author);
    if (!level) continue;
    const hasSource = matchesCatalogLink(book.source, book.title, book.author)
      || chapterReferences.all(book.id).some(({ html }) => typeof html === 'string' && referencesEnglishReader(html));
    if (hasSource) save.run(level, book.id);
  }
  database.prepare("INSERT INTO settings (name, value) VALUES (?, '1')").run(migration);
}
