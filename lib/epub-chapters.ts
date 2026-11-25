import { defaultTreeAdapter, parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import type { Chapter } from './types';

type Section = Pick<Chapter, 'title' | 'html'>;
type Element = DefaultTreeAdapterTypes.Element;
const chapterHeading = /^(?:chapter|capítulo)\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?)(?:\s*[:.\-–—]\s*.{0,100})?$/iu;

function headingText(node: DefaultTreeAdapterTypes.Node): string {
  if (defaultTreeAdapter.isTextNode(node)) return node.value;
  return 'childNodes' in node ? node.childNodes.map(headingText).join('') : '';
}

export function splitEpubSection({ title, html }: Section, firstNumber: number): Section[] {
  const fragment = parseFragment(html, { sourceCodeLocationInfo: true });
  const marks: { start: number; title: string; wrappers: Element[] }[] = [];
  function visit(parent: DefaultTreeAdapterTypes.ParentNode, wrappers: Element[]) {
    for (const node of parent.childNodes) {
      if (!defaultTreeAdapter.isElementNode(node)) continue;
      const label = /^(p|h[1-6]|div)$/.test(node.tagName) ? headingText(node).replace(/\s+/g, ' ').trim() : '';
      if (node.sourceCodeLocation && chapterHeading.test(label)) {
        marks.push({ start: node.sourceCodeLocation.startOffset, title: label, wrappers });
      } else if (node.tagName !== 'table' && node.tagName !== 'pre') {
        visit(node, [...wrappers, node]);
      }
    }
  }
  visit(fragment, []);

  const generic = !title.trim() || /^(?:unnamed|untitled|unknown)$/i.test(title.trim());
  const fallback = generic ? marks[0]?.title || `Capítulo ${firstNumber}` : title;
  if (marks.length < 2 || new Set(marks.map((mark) => mark.title.toLowerCase())).size !== marks.length) {
    return [{ title: fallback, html }];
  }

  const openingTags = (wrappers: Element[]) => wrappers.map((node) => {
    const tag = node.sourceCodeLocation?.startTag;
    return tag ? html.slice(tag.startOffset, tag.endOffset) : '';
  }).join('');
  const closingTags = (wrappers: Element[]) => wrappers.slice().reverse()
    .filter((node) => node.sourceCodeLocation?.startTag).map((node) => `</${node.tagName}>`).join('');

  // The first section also keeps the cover or front matter before its heading.
  return marks.map((mark, index) => {
    const next = marks[index + 1];
    const prefix = index ? openingTags(mark.wrappers) : '';
    const suffix = next ? closingTags(next.wrappers) : '';
    return { title: mark.title, html: prefix + html.slice(index ? mark.start : 0, next?.start) + suffix };
  });
}
