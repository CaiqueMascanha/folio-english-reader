export interface Book {
  id: string;
  title: string;
  author: string;
  level: string | null;
  format: 'EPUB' | 'TXT';
  cover: string | null;
  source: string | null;
  chapter: number;
  position: number;
  progress: number;
  favorite: boolean;
  openedAt: number | null;
  chapterCount: number;
}

export type CoverBook = Pick<Book, 'id' | 'title' | 'level' | 'format' | 'cover'>;
export type ChapterIndex = { number: number; title: string };
export type Chapter = ChapterIndex & { html: string };
export type BookAsset = { mime: string; bytes: Uint8Array<ArrayBuffer> };
export type ParsedBook = Pick<Book, 'title' | 'author' | 'level' | 'cover' | 'format'> & {
  chapters: Omit<Chapter, 'number'>[];
  assets: BookAsset[];
};
export type BookChanges = { favorite?: boolean; chapter?: number; position?: number; finished?: boolean; level?: string | null };
export type ImportResult = { book: Book; duplicate: boolean };

export type VocabularyEntry = {
  id: string;
  text: string;
  meaning: string;
  context: string;
  bookTitle: string;
  chapterTitle: string;
};
