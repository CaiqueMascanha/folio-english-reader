import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { repairEpubChapters } from './repair-epub-chapters';
import { repairEpubLevels } from '../features/library/levels/repair-epub-levels';
import type { Book, BookAsset, BookChanges, Chapter, ChapterIndex, ImportResult, ParsedBook, VocabularyEntry } from './types';

let database: DatabaseSync | undefined;

function db() {
  if (database) return database;
  const path = resolve(process.env.FOLIO_DB_PATH || 'data/folio.sqlite');
  mkdirSync(dirname(path), { recursive: true });
  const connection = new DatabaseSync(path);
  connection.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL,
      level TEXT, format TEXT NOT NULL, cover TEXT, digest TEXT UNIQUE,
      source TEXT, added_at INTEGER NOT NULL, opened_at INTEGER,
      chapter INTEGER NOT NULL DEFAULT 0, position REAL NOT NULL DEFAULT 0,
      progress REAL NOT NULL DEFAULT 0, favorite INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS chapters (
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      number INTEGER NOT NULL, title TEXT NOT NULL, html TEXT NOT NULL,
      PRIMARY KEY (book_id, number)
    );
    CREATE TABLE IF NOT EXISTS assets (
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      number INTEGER NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL,
      PRIMARY KEY (book_id, number)
    );
    CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS vocabulary (
      id TEXT PRIMARY KEY, text TEXT NOT NULL, meaning TEXT NOT NULL, context TEXT NOT NULL,
      book_title TEXT NOT NULL, chapter_title TEXT NOT NULL, added_at INTEGER NOT NULL
    );
  `);
  connection.exec('BEGIN IMMEDIATE');
  try {
    // Only previous versions created this marker and books with the DEMO format.
    if (connection.prepare("DELETE FROM settings WHERE name = 'seeded'").run().changes) {
      connection.prepare("DELETE FROM books WHERE format = 'DEMO' AND digest IS NULL").run();
    }
    repairEpubChapters(connection);
    repairEpubLevels(connection);
    connection.exec('COMMIT');
  } catch (error) {
    connection.exec('ROLLBACK');
    connection.close();
    throw error;
  }
  database = connection;
  return database;
}

const bookSelect = `SELECT id, title, author, level, format, cover, source, chapter, position, progress,
  favorite, opened_at AS openedAt,
  (SELECT count(*) FROM chapters WHERE book_id = books.id) AS chapterCount
  FROM books`;

type BookRow = Omit<Book, 'favorite'> & { favorite: number };

function serialize(row: BookRow | undefined): Book | null {
  if (!row) return null;
  return { ...row, favorite: Boolean(row.favorite) };
}

export function listBooks(): Book[] {
  const rows = db().prepare(`${bookSelect} ORDER BY added_at DESC, title`).all() as unknown as BookRow[];
  return rows.map(({ favorite, ...row }) => ({ ...row, favorite: Boolean(favorite) }));
}

export function getBook(id: string): Book | null {
  return serialize(db().prepare(`${bookSelect} WHERE id = ?`).get(id) as unknown as BookRow | undefined);
}

export function getContents(id: string): ChapterIndex[] {
  const rows = db().prepare('SELECT number, title FROM chapters WHERE book_id = ? ORDER BY number').all(id) as ChapterIndex[];
  return rows.map((row) => ({ ...row }));
}

export function readChapter(id: string, number: number): Chapter | undefined {
  const row = db().prepare('SELECT number, title, html FROM chapters WHERE book_id = ? AND number = ?').get(id, number) as Chapter | undefined;
  return row && { ...row };
}

export function readAsset(id: string, number: number): BookAsset | undefined {
  return db().prepare('SELECT mime, bytes FROM assets WHERE book_id = ? AND number = ?').get(id, number) as BookAsset | undefined;
}

export function addBook(bytes: Uint8Array, parse: (content: Uint8Array, id: string) => ParsedBook, source: string | null): ImportResult {
  const connection = db();
  const digest = createHash('sha256').update(bytes).digest('hex');
  const lookup = connection.prepare('SELECT id FROM books WHERE digest = ?');
  const existing = lookup.get(digest);
  if (typeof existing?.id === 'string') {
    const book = getBook(existing.id);
    if (book && (book.format !== 'EPUB' || book.level !== null)) return { book, duplicate: true };
  }

  const id = randomUUID();
  const parsed = parse(bytes, id);
  connection.exec('BEGIN IMMEDIATE');
  try {
    const concurrent = lookup.get(digest);
    if (typeof concurrent?.id === 'string') {
      if (parsed.format === 'EPUB' && parsed.level) {
        connection.prepare('UPDATE books SET level = ? WHERE id = ? AND level IS NULL').run(parsed.level, concurrent.id);
      }
      const book = getBook(concurrent.id);
      if (book) {
        connection.exec('COMMIT');
        return { book, duplicate: true };
      }
    }
    connection.prepare(`INSERT INTO books (id, title, author, level, format, cover, digest, source, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, parsed.title, parsed.author, parsed.level,
      parsed.format, parsed.cover, digest, source, Date.now());
    const chapter = connection.prepare('INSERT INTO chapters VALUES (?, ?, ?, ?)');
    parsed.chapters.forEach(({ title, html }, index) => chapter.run(id, index, title, html));
    const asset = connection.prepare('INSERT INTO assets VALUES (?, ?, ?, ?)');
    parsed.assets.forEach(({ mime, bytes: data }, index) => asset.run(id, index, mime, data));
    connection.exec('COMMIT');
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
  const saved = getBook(id);
  if (!saved) throw new Error('Imported book was not found after insertion');
  return { book: saved, duplicate: false };
}

export function updateBook(id: string, change: BookChanges) {
  const connection = db();
  const book = getBook(id);
  if (!book) return null;
  if (typeof change.favorite === 'boolean') {
    connection.prepare('UPDATE books SET favorite = ? WHERE id = ?').run(Number(change.favorite), id);
  }
  if (change.level !== undefined) {
    connection.prepare('UPDATE books SET level = ? WHERE id = ?').run(change.level, id);
  }
  if (typeof change.chapter === 'number' && Number.isInteger(change.chapter) && change.chapter >= 0 && change.chapter < book.chapterCount) {
    const position = typeof change.position === 'number' && Number.isFinite(change.position)
      ? Math.min(1, Math.max(0, change.position)) : 0;
    const progress = change.finished === true && change.chapter === book.chapterCount - 1
      ? 1 : Math.min(0.99, (change.chapter + position) / book.chapterCount);
    connection.prepare(`UPDATE books SET chapter = ?, position = ?, progress = ?, opened_at = ? WHERE id = ?`)
      .run(change.chapter, position, progress, Date.now(), id);
  }
  return getBook(id);
}

export function removeBook(id: string) {
  return Boolean(db().prepare('DELETE FROM books WHERE id = ?').run(id).changes);
}

export function listVocabulary(): VocabularyEntry[] {
  const rows = db().prepare(`SELECT id, text, meaning, context, book_title AS bookTitle,
    chapter_title AS chapterTitle FROM vocabulary ORDER BY added_at DESC, id`).all() as VocabularyEntry[];
  return rows.map((entry) => ({ ...entry }));
}

export function saveVocabulary(entry: Omit<VocabularyEntry, 'id' | 'bookTitle' | 'chapterTitle'>, bookId: string, chapter: number) {
  const book = getBook(bookId);
  const origin = book && readChapter(bookId, chapter);
  if (!book || !origin) return null;
  const saved = { ...entry, id: randomUUID(), bookTitle: book.title, chapterTitle: origin.title };
  db().prepare('INSERT INTO vocabulary VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(saved.id, saved.text, saved.meaning, saved.context, saved.bookTitle, saved.chapterTitle, Date.now());
  return saved;
}

export function editVocabulary(id: string, meaning: string) {
  return Boolean(db().prepare('UPDATE vocabulary SET meaning = ? WHERE id = ?').run(meaning, id).changes);
}
