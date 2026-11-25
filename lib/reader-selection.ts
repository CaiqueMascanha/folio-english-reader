import type { PassageAnchor } from '../features/translation/types';

export type ReaderExcerpt = { text: string; context: string; anchor?: PassageAnchor };
type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

function edgeText(range: Range, article: HTMLElement, before: boolean) {
  const node = before ? range.startContainer : range.endContainer;
  const offset = before ? range.startOffset : range.endOffset;
  const element = node instanceof Element ? node : node.parentElement;
  const block = element?.closest('p, li, blockquote, h1, h2, h3, h4, h5, h6, div, section');
  const edge = article.ownerDocument.createRange();
  edge.selectNodeContents(block && article.contains(block) ? block : article);
  if (before) edge.setEnd(node, offset);
  else edge.setStart(node, offset);
  const text = edge.toString().replace(/\s+/g, ' ');
  return before ? text.slice(-500) : text.slice(0, 500);
}

function excerpt(text: string, range: Range, article: HTMLElement): ReaderExcerpt | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  const before = edgeText(range, article, true);
  const after = edgeText(range, article, false);
  const context = before.trim() || after.trim() ? (before + normalized + after).trim().slice(0, 1000) : '';
  return { text: normalized, context, anchor: { text: normalized, before: before.slice(-160), after: after.slice(0, 160) } };
}

export function selectedExcerpt(article: HTMLElement | null) {
  const selection = window.getSelection();
  if (!article || !selection?.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!article.contains(range.startContainer) || !article.contains(range.endContainer)) return null;
  return excerpt(selection.toString(), range, article);
}

export function wordAtPoint(article: HTMLElement | null, x: number, y: number) {
  if (!article) return null;
  const doc: CaretDocument = article.ownerDocument;
  const hit = doc.caretPositionFromPoint?.(x, y);
  const legacy = hit ? null : doc.caretRangeFromPoint?.(x, y);
  const node = hit?.offsetNode ?? legacy?.startContainer;
  const offset = hit?.offset ?? legacy?.startOffset;
  if (!node || node.nodeType !== Node.TEXT_NODE || !article.contains(node) || offset === undefined) return null;

  const wordPattern = /[\p{L}\p{N}\p{M}]+(?:['’\u002d\u2010\u2011][\p{L}\p{N}\p{M}]+)*/gu;
  const range = doc.createRange();
  for (const match of (node.textContent ?? '').matchAll(wordPattern)) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset < start || offset > end) continue;
    range.setStart(node, start);
    range.setEnd(node, end);
    const onWord = Array.from(range.getClientRects()).some((box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);
    if (onWord) return excerpt(match[0], range, article);
  }
  return null;
}
