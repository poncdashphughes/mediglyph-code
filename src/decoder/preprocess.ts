/**
 * Pre-decode image hardening for real-world photos.
 *
 * Phones, shaky hands, awkward angles and uneven lighting all conspire to
 * make the captured image differ from the canonical glyph render. The
 * preprocessing pipeline tries to put the photo into a known-good state
 * before the geometric/sampling code runs:
 *
 *   1. Estimate the dominant background colour from the image corners so
 *      downstream "is this an ink pixel?" checks can adapt to non-pure-white
 *      paper, screens, or off-white plastic.
 *   2. Estimate the rotation of the glyph from the principal axis of the
 *      saturated pixels and de-rotate the canvas if it is more than ~1°
 *      off-horizontal. This removes a huge class of "decoding really didn't
 *      work" failures from hand-held photos.
 *
 * The result is a fresh canvas + context + cached ImageData buffer that the
 * rest of the decoder can sample from cheaply (one read, many reads).
 */

export interface PreprocessedImage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Estimated background colour (per channel mean of the corner samples). */
  background: { r: number; g: number; b: number };
  /** Rotation applied, in radians. 0 if no rotation was needed. */
  rotation: number;
}

const ROTATION_THRESHOLD_RAD = (1 * Math.PI) / 180; // 1°
const SATURATED_CHROMA = 50;

/** Sample a corner block to estimate the photo background. */
function sampleCorner(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  size: number,
): [number, number, number] {
  let r = 0, g = 0, b = 0, n = 0;
  const x0 = Math.max(0, cx - size);
  const y0 = Math.max(0, cy - size);
  const x1 = Math.min(width - 1, cx + size);
  const y1 = Math.min(height - 1, cy + size);
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  if (n === 0) return [255, 255, 255];
  return [r / n, g / n, b / n];
}

/**
 * Robust background estimate: take the median per-channel of the four
 * corner samples. A photo with one vignetted corner will not poison the
 * estimate.
 */
function estimateBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { r: number; g: number; b: number } {
  const block = Math.max(8, Math.round(Math.min(width, height) * 0.04));
  const corners = [
    sampleCorner(data, width, height, block, block, block),
    sampleCorner(data, width, height, width - block, block, block),
    sampleCorner(data, width, height, block, height - block, block),
    sampleCorner(data, width, height, width - block, height - block, block),
  ];
  const med = (idx: 0 | 1 | 2) =>
    [...corners.map((c) => c[idx])].sort((a, b) => a - b)[2]; // upper median of 4
  return { r: med(0), g: med(1), b: med(2) };
}

/**
 * Estimate the glyph's rotation from the bottom edge of its saturated
 * pixel cloud — the data grid's bottom row forms a long straight line
 * spanning the full glyph width.
 *
 * A principal-axis (covariance) estimate is unusable here: the glyph's
 * mass distribution is asymmetric (calibration block top-right, triage
 * squares top-left), which biases the major axis ~3° off-horizontal even
 * for a perfectly straight image.
 *
 * For each sampled column we record the bottom-most saturated pixel,
 * trim the outer columns (rotated corners), and take the Theil–Sen
 * median slope — robust to the occasional outlier column.
 */
function estimateRotation(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const step = 2;
  const xs: number[] = [];
  const ys: number[] = [];

  for (let x = 0; x < width; x += step) {
    for (let y = height - 1; y >= 0; y--) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (chroma >= SATURATED_CHROMA) {
        xs.push(x);
        ys.push(y);
        break;
      }
    }
  }
  if (xs.length < 30) return 0;

  // Trim outer 15% of columns — rotated corners shorten the edge there
  const trim = Math.floor(xs.length * 0.15);
  const tx = xs.slice(trim, xs.length - trim);
  const ty = ys.slice(trim, ys.length - trim);
  if (tx.length < 20) return 0;

  // Theil–Sen: median slope over sampled point pairs
  const slopes: number[] = [];
  const pairStep = Math.max(1, Math.floor(tx.length / 60));
  for (let i = 0; i < tx.length; i += pairStep) {
    for (let j = i + Math.floor(tx.length / 3); j < tx.length; j += pairStep) {
      const dx = tx[j] - tx[i];
      if (dx > 0) slopes.push((ty[j] - ty[i]) / dx);
    }
  }
  if (slopes.length === 0) return 0;
  slopes.sort((a, b) => a - b);
  const slope = slopes[slopes.length >> 1];

  const angle = Math.atan(slope);
  // Only correct plausible hand-held tilts
  if (Math.abs(angle) > Math.PI / 4) return 0;
  return angle;
}

/** Rotate a canvas by `-angle` radians, returning a fresh canvas+ctx
 *  sized to the rotated bounding box, on a white background. */
function rotateCanvas(
  src: HTMLCanvasElement,
  angle: number,
  background: { r: number; g: number; b: number },
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const outW = Math.ceil(src.width * cos + src.height * sin);
  const outH = Math.ceil(src.width * sin + src.height * cos);

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = `rgb(${Math.round(background.r)}, ${Math.round(background.g)}, ${Math.round(background.b)})`;
  ctx.fillRect(0, 0, outW, outH);
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(-angle);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas: out, ctx };
}

export function preprocessImage(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  opts: { allowRotation?: boolean } = {},
): PreprocessedImage {
  const w0 = canvas.width;
  const h0 = canvas.height;
  const data0 = ctx.getImageData(0, 0, w0, h0).data;

  const background = estimateBackground(data0, w0, h0);
  const allowRotation = opts.allowRotation !== false;
  const angle = allowRotation ? estimateRotation(data0, w0, h0) : 0;

  if (Math.abs(angle) < ROTATION_THRESHOLD_RAD) {
    return {
      canvas,
      ctx,
      data: data0,
      width: w0,
      height: h0,
      background,
      rotation: 0,
    };
  }

  const rotated = rotateCanvas(canvas, angle, background);
  const data = rotated.ctx.getImageData(0, 0, rotated.canvas.width, rotated.canvas.height).data;
  return {
    canvas: rotated.canvas,
    ctx: rotated.ctx,
    data,
    width: rotated.canvas.width,
    height: rotated.canvas.height,
    background,
    rotation: angle,
  };
}
