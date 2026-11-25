import type { DatabaseSync } from 'node:sqlite';
import { splitEpubSection } from './epub-chapters';
import type { Chapter } from './types';

export function repairEpubChapters(db: DatabaseSync) {
  const migration = 'epub-inline-chapters-v1';
  if (db.prepare('SELECT 1 FROM settings WHERE name = ?').get(migration)) return;

  const books = db.prepare("SELECT id, chapter, position, progress FROM books WHERE format = 'EPUB'").all() as {
    id: string; chapter: number; position: number; progress: number;
  }[];
  const read = db.prepare('SELECT number, title, html FROM chapters WHERE book_id = ? ORDER BY number');
  const remove = db.prepare('DELETE FROM chapters WHERE book_id = ?');
  const insert = db.prepare('INSERT INTO chapters VALUES (?, ?, ?, ?)');
  const update = db.prepare('UPDATE books SET chapter = ?, position = ?, progress = ? WHERE id = ?');

  for (const book of books) {
    const oldChapters = read.all(book.id) as Chapter[];
    const sections = oldChapters.flatMap((old) =>
      splitEpubSection(old, old.number + 1).map((section) => ({ ...section, original: old.number })),
    );
    if (sections.length === oldChapters.length && sections.every((section, i) => section.title === oldChapters[i].title)) continue;

    const currentSections = sections.filter(({ original }) => original === book.chapter);
    if (!currentSections.length) continue;
    let current = sections.indexOf(currentSections[0]);
    let position = book.position;
    if (currentSections.length > 1) {
      // Old books store page fraction only. Markup length approximates where
      // that fraction falls in the newly separated chapters.
      let remaining = position * currentSections.reduce((total, section) => total + section.html.length, 0);
      for (const section of currentSections.slice(0, -1)) {
        if (remaining < section.html.length) break;
        remaining -= section.html.length;
        current++;
      }
      position = Math.min(1, remaining / sections[current].html.length);
    }
    remove.run(book.id);
    sections.forEach((section, index) => insert.run(book.id, index, section.title, section.html));
    update.run(current, position, book.progress === 1 ? 1 : Math.min(0.99, (current + position) / sections.length), book.id);
  }
  db.prepare("INSERT INTO settings (name, value) VALUES (?, '1')").run(migration);
}
