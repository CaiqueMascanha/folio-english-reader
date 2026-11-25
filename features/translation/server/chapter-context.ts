import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import type { PassageAnchor } from '../types';

export const BOOK_CONTEXT_CHARACTERS = 12_000;

const blockTags = new Set(['address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt',
  'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'ol', 'p', 'pre', 'section', 'table', 'td', 'th', 'tr', 'ul']);
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

function chapterText(html: string) {
  const parts: string[] = [];
  const stack: (DefaultTreeAdapterTypes.Node | string)[] = [parseFragment(html)];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (typeof node === 'string') {
      parts.push(node);
    } else if ('value' in node && node.nodeName === '#text') {
      parts.push(node.value);
    } else if ('childNodes' in node) {
      const isBlock = 'tagName' in node && blockTags.has(node.tagName);
      if (isBlock) stack.push(' ');
      for (let index = node.childNodes.length - 1; index >= 0; index--) stack.push(node.childNodes[index]);
      if (isBlock) stack.push(' ');
    }
  }
  return normalize(parts.join(''));
}

function matchingLength(left: string, right: string, fromEnd = false) {
  const limit = Math.min(left.length, right.length);
  let matched = 0;
  while (matched < limit && left[fromEnd ? left.length - 1 - matched : matched] === right[fromEnd ? right.length - 1 - matched : matched]) {
    matched++;
  }
  return matched;
}

function findPassage(chapter: string, selected: string, anchor?: PassageAnchor) {
  const escaped = selected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}\\p{M}])${escaped}(?![\\p{L}\\p{N}\\p{M}])`, 'giu');
  const before = anchor?.before.toLowerCase() ?? '';
  const after = anchor?.after.toLowerCase() ?? '';
  let best: { start: number; end: number; score: number } | null = null;
  let tied = false;
  for (const match of chapter.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    const score = matchingLength(chapter.slice(Math.max(0, start - before.length), start).toLowerCase(), before, true)
      + matchingLength(chapter.slice(end, end + after.length).toLowerCase(), after);
    if (!best || score > best.score) {
      best = { start, end, score };
      tied = false;
    } else if (score === best.score) {
      tied = true;
    }
  }
  return tied ? null : best;
}

export function getSurroundingText(html: string, selected: string, anchor: PassageAnchor | undefined, limit: number) {
  const chapter = chapterText(html);
  const phrase = normalize(selected);
  const relevantAnchor = anchor && normalize(anchor.text) === phrase ? anchor : undefined;
  const passage = findPassage(chapter, phrase, relevantAnchor);
  if (!passage) {
    return { before: relevantAnchor?.before ?? '', after: relevantAnchor?.after ?? '' };
  }

  const { start, end } = passage;
  const contextBudget = Math.max(0, limit - (end - start));
  const left = Math.min(start, Math.max(Math.floor(contextBudget / 2), contextBudget - (chapter.length - end)));
  const right = contextBudget - left;
  return {
    before: chapter.slice(start - left, start),
    after: chapter.slice(end, end + right),
  };
}
