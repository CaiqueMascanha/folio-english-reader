import { levels, type Level } from '../../../lib/levels';
import editions from './english-reader-editions.json';

// Bibliographic metadata from https://english-e-reader.net/level/ (November 2026).
// Keep ambiguous editions unresolved when the catalogue lists multiple levels.
function normalize(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/['’‘`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function editionKey(title: string, author: string) {
  return `${normalize(title)}|${normalize(author)}`;
}

const byEdition = new Map<string, Level | null>();
for (const level of levels) {
  for (const [title, author] of editions[level]) {
    const key = editionKey(title, author);
    const previous = byEdition.get(key);
    byEdition.set(key, previous === undefined || previous === level ? level : null);
  }
}

export function catalogLevel(title: string, author: string) {
  return byEdition.get(editionKey(title, author)) ?? null;
}

export function referencesEnglishReader(value: string) {
  // Older downloads identify the catalogue by its former domain.
  return /https?:\/\/(?:www\.)?english-e-(?:reader|books)\.net(?=\/|[\s<"'?#]|$)/i.test(value);
}

export function matchesCatalogLink(source: string | null, title: string, author: string) {
  if (!source) return false;
  const slug = normalize(`${title} ${author}`).replaceAll(' ', '-');
  return source.replace(/\/$/, '') === `https://english-e-reader.net/book/${slug}`;
}
