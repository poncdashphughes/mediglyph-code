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
 * Estimate the dominant rotation of the glyph from the principal axis of
 * its saturated pixels. Returns radians in (-π/4, π/4]; rotations larger
 * than that get folded into the range, which is fine — we do not try to
 * correct 90°/180° flips here.
 *
 * Algorithm: 2×2 covariance of saturated-pixel coordinates → eigenvector
 * of the larger eigenvalue → angle from horizontal. The glyph is wider
 * than tall (24×14 mm) so the major axis is the horizontal axis and the
 * angle that returns it to horizontal is `-θ`.
 */
function estimateRotation(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  // Subsample for speed — every 3rd pixel is enough to fit a covariance.
  const step = 3;
  let n = 0;
  let sumX = 0, sumY = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (chroma >= SATURATED_CHROMA) {
        sumX += x;
        sumY += y;
        n++;
      }
    }
  }
  if (n < 50) return 0;
  const cx = sumX / n;
  const cy = sumY / n;

  let sxx = 0, syy = 0, sxy = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (chroma >= SATURATED_CHROMA) {
        const dx = x - cx;
        const dy = y - cy;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
      }
    }
  }
  // Principal axis angle. atan2(2*Sxy, Sxx-Syy) / 2 is in (-π/2, π/2].
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  // Fold into (-π/4, π/4] so we only correct small tilts (the glyph is
  // landscape-aspect, so the major axis is already near-horizontal).
  let folded = theta;
  while (folded > Math.PI / 4) folded -= Math.PI / 2;
  while (folded <= -Math.PI / 4) folded += Math.PI / 2;
  return folded;
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
): PreprocessedImage {
  const w0 = canvas.width;
  const h0 = canvas.height;
  const data0 = ctx.getImageData(0, 0, w0, h0).data;

  const background = estimateBackground(data0, w0, h0);
  const angle = estimateRotation(data0, w0, h0);

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
