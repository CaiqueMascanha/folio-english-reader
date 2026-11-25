// Capture the visible type and illustrations at their browser-measured positions.
// The live article remains selectable and keeps its original pagination.
function intersects(a: DOMRect, b: DOMRect) {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
}

function paintText(ctx: CanvasRenderingContext2D, node: Text, clip: DOMRect) {
  const element = node.parentElement;
  if (!element || !node.data.trim()) return;
  const range = document.createRange();
  const lines: { start: number; end: number; box: DOMRect; right: number }[] = [];

  function collect(start: number, end: number) {
    range.setStart(node, start);
    range.setEnd(node, end);
    const boxes = Array.from(range.getClientRects());
    if (!boxes.some((box) => intersects(box, clip))) return;
    if (boxes.length > 1 && end - start > 1) {
      const middle = start + Math.floor((end - start) / 2);
      collect(start, middle);
      collect(middle, end);
      return;
    }
    const box = boxes[0];
    const previous = lines.at(-1);
    if (previous && previous.end === start && previous.box.top === box.top && Math.abs(previous.right - box.left) < 1) {
      previous.end = end;
      previous.right = box.right;
    } else {
      lines.push({ start, end, box, right: box.right });
    }
  }

  collect(0, node.length);
  if (!lines.length) return;
  const style = getComputedStyle(element);
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.fillStyle = style.color;
  const metrics = ctx.measureText('Mg');
  const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
  for (const { start, end, box, right } of lines) {
    const value = node.data.slice(start, end);
    const line = style.whiteSpace.startsWith('pre') ? value : value.replace(/\s+/g, ' ');
    ctx.fillText(line, box.left, box.top + (box.height + ascent - descent) / 2, right - box.left);
  }
}

function paintContents(ctx: CanvasRenderingContext2D, parent: Element, clip: DOMRect) {
  for (const child of parent.childNodes) {
    if (child instanceof Text) {
      paintText(ctx, child, clip);
    } else if (child instanceof Element && Array.from(child.getClientRects()).some((box) => intersects(box, clip))) {
      if (child instanceof HTMLImageElement) {
        if (child.complete && child.naturalWidth) {
          const box = child.getBoundingClientRect();
          ctx.drawImage(child, box.left, box.top, box.width, box.height);
        }
      } else {
        paintContents(ctx, child, clip);
      }
    }
  }
}

function paintSheet(sheet: HTMLElement, scale: number) {
  const box = sheet.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return null;
  const image = document.createElement('canvas');
  image.width = Math.round(box.width * scale);
  image.height = Math.round(box.height * scale);
  const ctx = image.getContext('2d');
  if (!ctx) return null;
  ctx.scale(image.width / box.width, image.height / box.height);
  ctx.translate(-box.left, -box.top);
  ctx.fillStyle = getComputedStyle(sheet).backgroundColor;
  ctx.fillRect(box.left, box.top, box.width, box.height);

  for (const selector of ['.sheet-top', '.sheet-bottom']) {
    const band = sheet.querySelector(selector);
    if (!band) continue;
    const bounds = band.getBoundingClientRect();
    paintContents(ctx, band, bounds);
    ctx.fillStyle = getComputedStyle(sheet).borderColor;
    ctx.fillRect(bounds.left, selector === '.sheet-top' ? bounds.bottom - 1 : bounds.top, bounds.width, 1);
  }

  const viewport = sheet.querySelector('.paper-viewport');
  const article = sheet.querySelector('.book-text');
  if (viewport && article) {
    const clip = viewport.getBoundingClientRect();
    ctx.beginPath();
    ctx.rect(clip.left, clip.top, clip.width, clip.height);
    ctx.clip();
    // A CSS multi-column article can have visible text beyond its own bounding box.
    paintContents(ctx, article, clip);
  }
  return image;
}

export function captureSheet(sheet: HTMLElement, scale: number) {
  try {
    return paintSheet(sheet, scale);
  } catch (error) {
    // A browser may discard a canvas or an image while a chapter is loading.
    if (error instanceof DOMException || error instanceof RangeError) return null;
    throw error;
  }
}
