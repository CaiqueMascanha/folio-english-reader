import { posix } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { unzipSync } from 'fflate';
import { parse, defaultTreeAdapter, type DefaultTreeAdapterTypes } from 'parse5';
import type { ParsedBook } from './types';
import { splitEpubSection } from './epub-chapters';
import { detectLevel } from './levels';
import { catalogLevel, matchesCatalogLink, referencesEnglishReader } from '../features/library/levels/english-reader-catalog';

type HtmlNode = DefaultTreeAdapterTypes.Node;

export const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_EXPANDED_SIZE = 80 * 1024 * 1024;
const chapterTypes = new Set(['application/xhtml+xml', 'text/html']);
const imageTypes: Readonly<Record<string, string>> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' };
const allowed = new Set('p div section article aside h1 h2 h3 h4 h5 h6 em i strong b u s small sub sup blockquote pre code br hr ul ol li dl dt dd table tbody thead tfoot tr th td figure figcaption ruby rt rp span'.split(' '));
const drop = new Set('head script style iframe frame object embed video audio source form button input svg math nav template'.split(' '));
const fileTitle = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 240) || 'Sem título';
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const descendants = (element: Document | Element, localName: string) => Array.from(element.getElementsByTagName('*')).filter((node) => node.localName === localName);

export class ImportError extends Error {}

function decode(bytes: Uint8Array, plainText = false) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: plainText }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function relativeFile(from: string, href: string) {
  try {
    const path = decodeURIComponent(href.split(/[?#]/, 1)[0]);
    if (!path || /^(\/|[a-z][a-z0-9+.-]*:)|[\\\0]/i.test(path)) return null;
    const normalized = posix.join(posix.dirname(from), path);
    return normalized.startsWith('../') || normalized === '..' ? null : normalized;
  } catch {
    return null;
  }
}

function findNode(node: HtmlNode | null, match: (node: HtmlNode) => boolean): HtmlNode | null {
  if (!node) return null;
  if (match(node)) return node;
  for (const child of 'childNodes' in node ? node.childNodes : []) {
    const found = findNode(child, match);
    if (found) return found;
  }
  return null;
}

function getText(node: HtmlNode | null): string {
  if (!node) return '';
  if (defaultTreeAdapter.isTextNode(node)) return node.value;
  return 'childNodes' in node ? node.childNodes.map(getText).join('') : '';
}

function renderNode(node: HtmlNode | null, image: (href: string) => string | null, depth = 0): string {
  if (!node || depth > 64) return '';
  if (defaultTreeAdapter.isTextNode(node)) return escape(node.value);
  const tag = 'tagName' in node ? node.tagName : '';
  if (drop.has(tag)) return '';
  if ('attrs' in node && tag === 'img') {
    const attribute = (key: string) => node.attrs.find(({ name }) => name === key)?.value ?? '';
    const src = image(attribute('src'));
    return src ? `<img src="${src}" alt="${escape(attribute('alt'))}">` : '';
  }
  const content = 'childNodes' in node ? node.childNodes.map((child) => renderNode(child, image, depth + 1)).join('') : '';
  if (!allowed.has(tag)) return content;
  if (tag === 'br' || tag === 'hr') return `<${tag}>`;
  return `<${tag}>${content}</${tag}>`;
}

function epubBook(bytes: Uint8Array, id: string, name: string, source: string | null): ParsedBook {
  let expanded = 0;
  let entries = 0;
  const files = unzipSync(bytes, { filter(entry) {
    expanded += entry.originalSize;
    entries += 1;
    if (entries > 8000 || expanded > MAX_EXPANDED_SIZE) throw new ImportError('Este EPUB é grande demais para descompactar.');
    return /\.(xml|opf|xhtml|html?|jpg|jpeg|png|gif|webp|avif)$/i.test(entry.name);
  } });
  const readXml = (path: string | null | undefined) => {
    if (!path || !Object.hasOwn(files, path)) throw new ImportError('A estrutura deste EPUB está incompleta.');
    return new DOMParser().parseFromString(decode(files[path]), 'application/xml');
  };
  const container = readXml('META-INF/container.xml');
  const packagePath = descendants(container, 'rootfile')[0]?.getAttribute('full-path');
  if (!packagePath) throw new ImportError('O EPUB não indica onde estão os capítulos.');
  const book = readXml(packagePath);
  const meta = descendants(book, 'metadata')[0] || book;
  const metadata = (key: string) => descendants(meta, key).map((item) => item.textContent?.trim() || '').filter(Boolean);
  const title = metadata('title')[0]?.slice(0, 240) || fileTitle(name);
  const author = metadata('creator').join(', ').slice(0, 240) || 'Autor desconhecido';
  const levelFields = ['educationalLevel', 'educationLevel', 'readingLevel', 'cefr', 'level'];
  const levelProperties = descendants(meta, 'meta').flatMap((tag) => {
    const property = tag.getAttribute('property') || tag.getAttribute('name') || '';
    if (!/(?:^|[:/#])(?:education(?:al)?[-_ ]?level|reading[-_ ]?level|cefr|level)$/i.test(property)) return [];
    const value = tag.getAttribute('content') || tag.textContent || '';
    if (!property.startsWith('calibre:user_metadata:')) return [value];
    try {
      const selected: unknown = JSON.parse(value)['#value#'];
      return typeof selected === 'string' ? [selected] : [];
    } catch { return []; }
  });
  const declaredLevel = detectLevel([...levelFields.flatMap(metadata), ...levelProperties, ...metadata('subject')], name);
  const editionLevel = declaredLevel ? null : catalogLevel(title, author);
  let fromCatalog = matchesCatalogLink(source, title, author)
    || [...metadata('publisher'), ...metadata('source'), ...metadata('identifier')].some(referencesEnglishReader);
  const manifest = new Map(descendants(book, 'item').map((item) => [item.getAttribute('id'), item]));
  const assets: ParsedBook['assets'] = [];
  const imagePaths = new Map<string, string>();
  function imageUrl(path: string | null): string | null {
    if (!path || !Object.hasOwn(files, path)) return null;
    const saved = imagePaths.get(path);
    if (saved) return saved;
    const mime = imageTypes[posix.extname(path).slice(1).toLowerCase()];
    if (!mime || !files[path].length) return null;
    const url = `/api/books/${id}/assets/${assets.length}`;
    assets.push({ mime, bytes: Uint8Array.from(files[path]) });
    imagePaths.set(path, url);
    return url;
  }
  const coverId = descendants(meta, 'meta').find((tag) => tag.getAttribute('name') === 'cover')?.getAttribute('content');
  const coverItem = [...manifest.values()].find((tag) => tag.getAttribute('properties')?.split(/\s+/).includes('cover-image'))
    || manifest.get(coverId ?? null);
  const cover = imageUrl(relativeFile(packagePath, coverItem?.getAttribute('href') || ''));
  const spine = descendants(book, 'spine')[0] || book;
  const chapters: ParsedBook['chapters'] = [];
  for (const entry of descendants(spine, 'itemref')) {
    const item = manifest.get(entry.getAttribute('idref'));
    if (!item || !chapterTypes.has(item.getAttribute('media-type') || '')) continue;
    const path = relativeFile(packagePath, item.getAttribute('href') || '');
    if (!path || !Object.hasOwn(files, path)) continue;
    const markup = decode(files[path]);
    if (editionLevel && !fromCatalog) fromCatalog = referencesEnglishReader(markup);
    const document = parse(markup);
    const body = findNode(document, (node) => 'tagName' in node && node.tagName === 'body');
    const html = renderNode(body, (href) => imageUrl(relativeFile(path, href)));
    if (!html.replace(/<[^>]*>/g, '').trim() && !html.includes('<img ')) continue;
    const heading = findNode(body, (node) => 'tagName' in node && /^h[1-6]$/.test(node.tagName));
    const label = getText(heading).trim() || getText(findNode(document, (node) => 'tagName' in node && node.tagName === 'title')).trim();
    for (const section of splitEpubSection({ title: label.slice(0, 160), html }, chapters.length + 1)) chapters.push(section);
  }
  if (!chapters.length) throw new ImportError('Este EPUB não contém capítulos legíveis. Confira se o arquivo tem DRM ou está danificado.');
  const level = declaredLevel ?? (fromCatalog ? editionLevel : null);
  return { title, author, level, format: 'EPUB', cover, chapters, assets };
}

function textBook(bytes: Uint8Array, name: string): ParsedBook {
  const content = decode(bytes, true).replace(/\r\n?/g, '\n').trim();
  if (!content || /[\u0000-\u0008\u000b\u000e-\u001f]/.test(content)) throw new ImportError('O TXT está vazio ou não contém texto válido.');
  const title = fileTitle(name);
  const chapters: ParsedBook['chapters'] = [];
  let heading = title;
  let lines: string[] = [];
  function appendChapter() {
    const text = lines.join('\n').trim();
    if (text) {
      const paragraphs = text.split(/\n\s*\n/);
      const blocks = paragraphs.length === 1 ? text.split('\n') : paragraphs;
      chapters.push({ title: heading, html: blocks.filter((part) => part.trim()).map((part) => `<p>${escape(part.trim()).replaceAll('\n', '<br>')}</p>`).join('') });
    }
    lines = [];
  }
  for (const line of content.split('\n')) {
    if (/^\s*(chapter|cap[ií]tulo)\s+(?:\d+|[ivxlcdm]+)\b.{0,120}$/i.test(line)) {
      appendChapter();
      heading = line.trim();
    } else {
      lines.push(line);
    }
  }
  appendChapter();
  if (!chapters.length) throw new ImportError('O TXT está vazio.');
  return { title, author: 'Autor desconhecido', level: detectLevel([], name), format: 'TXT', cover: null, chapters, assets: [] };
}

export function parseBook(bytes: Uint8Array, id: string, name: string, source: string | null = null) {
  if (!bytes.length) throw new ImportError('Este arquivo está vazio.');
  if (name.toLowerCase().endsWith('.txt')) return textBook(bytes, name);
  try {
    return epubBook(bytes, id, name, source);
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError('Não foi possível ler o EPUB. Confira se o arquivo é válido e tente novamente.');
  }
}

export function catalogLink(input: unknown) {
  if (typeof input !== 'string' || !input.trim()) return null;
  try {
    const url = new URL(input);
    if (url.protocol === 'https:' && url.origin === 'https://english-e-reader.net' && !url.username && !url.password && /^\/book\/[a-z0-9-]+\/?$/i.test(url.pathname)) {
      return `${url.origin}${url.pathname}`;
    }
  } catch {}
  throw new ImportError('Cole o endereço da página do livro no English e-Reader.');
}
