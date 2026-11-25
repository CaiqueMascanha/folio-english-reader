import type { CoverBook } from '@/lib/types';

export function paperTexture(THREE: typeof import('three')) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#f0dfc2';
  ctx.fillRect(0, 0, 128, 8);
  for (let x = 1; x < 128; x += 3) {
    ctx.fillStyle = x % 2 ? '#c7b29b' : '#dcc7ad';
    ctx.fillRect(x, 0, 1, 8);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

export async function coverTexture(THREE: typeof import('three'), book: CoverBook) {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D unavailable');
  context.fillStyle = '#29154b';
  context.fillRect(0, 0, 480, 640);
  if (book.cover?.startsWith('/api/')) {
    const image = await loadImage(book.cover);
    const fit = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const width = image.naturalWidth * fit;
    const height = image.naturalHeight * fit;
    context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  } else {
    const tint = context.createLinearGradient(0, 0, 0, 500);
    tint.addColorStop(0, 'rgba(17,8,32,.84)');
    tint.addColorStop(0.62, 'rgba(17,8,32,.20)');
    tint.addColorStop(1, 'rgba(17,8,32,0)');
    context.fillStyle = tint;
    context.fillRect(0, 0, 480, 640);
    context.fillStyle = '#ccff70';
    context.textAlign = 'center';
    context.font = '700 16px Arial';
    context.letterSpacing = '4px';
    context.fillText('FOLIO', 245, 62);
    context.letterSpacing = '0px';
    context.fillStyle = '#f6edff';
    context.font = '700 62px Georgia';
    const lines: string[] = [];
    let line = '';
    for (const word of book.title.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > 390) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
    lines.slice(0, 5).forEach((line, index) => context.fillText(line, 245, 145 + index * 66, 390));
    context.fillStyle = '#ccff70';
    context.fillRect(222, 170 + Math.min(4, lines.length - 1) * 66, 46, 2);
    context.font = '700 14px Arial';
    context.letterSpacing = '3px';
    context.fillText(book.level ? `${book.level}  ·  ENGLISH READER` : book.format, 245, 603);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

