type PaperTurn = {
  ctx: CanvasRenderingContext2D;
  before: HTMLCanvasElement;
  after: HTMLCanvasElement;
  width: number;
  height: number;
  spread: boolean;
  backward: boolean;
  paper: string;
};

// Roll an inextensible sheet around a tilted cylinder. Distances are measured
// along the paper from the spine; the middle section keeps its arc length.
function bend(distance: number, start: number, radius: number) {
  const arc = Math.max(0, Math.min(Math.PI, (distance - start) / radius));
  const flatBack = Math.max(0, distance - start - Math.PI * radius);
  const projected = Math.min(distance, start) + radius * Math.sin(arc) - flatBack;
  const height = radius * (1 - Math.cos(arc));
  return { shift: projected - distance, height, arc };
}

function drawFace(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, rightHalf: boolean, spread: boolean, width: number, height: number) {
  const crop = spread ? image.width / 2 : image.width;
  ctx.drawImage(image, rightHalf && spread ? crop : 0, 0, crop, image.height, 0, 0, width, height);
}

// A strip is flat across the cylinder's axis. Projecting each short arc as an
// affine strip lets text and illustrations bend together even without WebGL.
export function drawPaperTurn(turn: PaperTurn, elapsed: number) {
  const { ctx, before, after, height, spread, backward, paper } = turn;
  const width = spread ? turn.width / 2 : turn.width;
  const front = backward ? after : before;
  const back = backward ? before : after;
  const t = backward ? 1 - elapsed : elapsed;

  // Keep a full paper surface beneath the curl in every frame. The compositor
  // need not reveal or repaint the live CSS columns through a transparent canvas.
  ctx.drawImage(after, 0, 0, turn.width, height);
  ctx.save();
  if (spread) ctx.translate(width, 0);
  // Keep the stationary half from the old spread (the whole old page when
  // going back on mobile) until it is covered by the turning sheet.
  if (backward) {
    drawFace(ctx, before, true, spread, width, height);
  } else if (spread) {
    ctx.save();
    ctx.translate(-width, 0);
    drawFace(ctx, before, false, true, width, height);
    ctx.restore();
  }

  const lift = Math.sin(Math.PI * t);
  const radius = Math.max(0.01, width * 0.145 * lift);
  const tilt = Math.atan(0.45 * width / height) * lift * (1 - 0.72 * t);
  const nx = Math.cos(tilt);
  const ny = Math.sin(tilt);
  const start = width * (1 - t) - Math.PI * radius / 2;
  const minDistance = -ny * height / 2;
  const maxDistance = nx * width + ny * height / 2;
  const axisExtent = width + height;

  if (lift > 0.001) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(spread ? -width : 0, 0, turn.width, height);
    ctx.clip();
    ctx.translate(0, height / 2);
    ctx.rotate(tilt);
    const crest = start + radius;
    const shadowWidth = width * 0.16 * lift;
    const shadow = ctx.createLinearGradient(crest - shadowWidth * .35, 0, crest + shadowWidth, 0);
    shadow.addColorStop(0, 'transparent');
    shadow.addColorStop(.3, `rgba(27,18,14,${0.28 * lift})`);
    shadow.addColorStop(1, 'transparent');
    ctx.fillStyle = shadow;
    ctx.fillRect(crest - shadowWidth * .35, -axisExtent, shadowWidth * 1.35, axisExtent * 2);
    ctx.restore();
  }

  function paintStrip(from: number, to: number) {
    if (to <= from) return;
    const a = bend(from, start, radius);
    const b = bend(to, start, radius);
    // Oblique projection moves the raised page slightly toward the reader.
    const ax = nx * a.shift + .07 * a.height;
    const ay = ny * a.shift - .23 * a.height;
    const bx = nx * b.shift + .07 * b.height;
    const by = ny * b.shift - .23 * b.height;
    const dx = (bx - ax) / (to - from);
    const dy = (by - ay) / (to - from);
    const determinant = 1 + nx * dx + ny * dy;
    if (Math.abs(determinant) < 0.001) return;
    const reverse = determinant < 0;
    const intercept = from + ny * height / 2;

    ctx.save();
    ctx.transform(1 + dx * nx, dy * nx, dx * ny, 1 + dy * ny, ax - dx * intercept, ay - dy * intercept);
    // Overlap adjacent samples by a fraction of a pixel to avoid antialias seams.
    const left = from - .6;
    const right = to + .6;
    ctx.beginPath();
    ctx.moveTo(nx * left + ny * axisExtent, height / 2 + ny * left - nx * axisExtent);
    ctx.lineTo(nx * right + ny * axisExtent, height / 2 + ny * right - nx * axisExtent);
    ctx.lineTo(nx * right - ny * axisExtent, height / 2 + ny * right + nx * axisExtent);
    ctx.lineTo(nx * left - ny * axisExtent, height / 2 + ny * left + nx * axisExtent);
    ctx.closePath();
    ctx.clip();

    if (reverse && spread) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      drawFace(ctx, back, false, true, width, height);
    } else if (reverse) {
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = .055;
      drawFace(ctx, front, true, false, width, height);
      ctx.globalAlpha = 1;
    } else {
      drawFace(ctx, front, true, spread, width, height);
    }
    const angle = (a.arc + b.arc) / 2;
    const shade = .23 * Math.sin(angle) + (reverse ? .055 * lift : 0);
    if (shade > .001) {
      ctx.fillStyle = `rgba(36,24,18,${shade})`;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  // Paint in depth order: the bound section, the rounded fold, then the verso.
  paintStrip(minDistance, Math.min(start, maxDistance));
  const curveStart = Math.max(minDistance, start);
  const curveEnd = Math.min(maxDistance, start + Math.PI * radius);
  const strips = Math.min(48, Math.ceil((curveEnd - curveStart) / 4));
  for (let i = 0; i < strips; i++) {
    const step = (curveEnd - curveStart) / strips;
    paintStrip(curveStart + i * step, curveStart + (i + 1) * step);
  }
  paintStrip(Math.max(minDistance, start + Math.PI * radius), maxDistance);
  ctx.restore();
}
