import { PALETTE, TIER_RGB, colorDistance } from '../core/palette';
import type { ColourMatch } from '../core/types';

export type RGB = [number, number, number];

/** A calibrated palette — one observed RGB mean per palette index. */
export type PaletteLUT = RGB[];

/** Match an RGB sample to the closest entry in a reference palette. */
export function matchToReference(
  sample: number[],
  reference: ReadonlyArray<RGB | number[]>,
): ColourMatch {
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < reference.length; i++) {
    const dist = colorDistance(sample, reference[i]);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  const confidence = bestDist < 30 ? 1.0 : bestDist < 60 ? 0.8 : bestDist < 100 ? 0.5 : 0.2;
  return {
    index: bestIndex,
    distance: bestDist,
    confidence,
    color: PALETTE[bestIndex]?.name ?? String(bestIndex),
  };
}

/** Match against the canonical palette (fallback when no LUT). */
export function matchToPalette(sample: number[]): ColourMatch {
  return matchToReference(sample, PALETTE.map((p) => p.rgb));
}

/** Match a tier indicator against active / inactive reference colours. */
export function matchTierColor(
  sample: number[],
  tier: number,
): { valid: boolean; active: boolean } {
  const activeRgb = TIER_RGB[tier];
  const inactiveRgb = TIER_RGB.inactive;
  const distToActive = colorDistance(sample, activeRgb);
  const distToInactive = colorDistance(sample, inactiveRgb);
  const valid = distToActive < 100 || distToInactive < 100;
  const active = distToActive < distToInactive && distToActive < 100;
  return { valid, active };
}

/**
 * Image buffer the decoder samples from. Reading the whole canvas once
 * with `getImageData` and then reading from the typed array directly is
 * 50–100× faster than calling `getImageData(x,y,1,1)` per pixel — and
 * crucially it avoids the per-call canvas-flush penalty in browsers.
 */
export interface ImageBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const m = values.length >> 1;
  return values.length % 2 ? values[m] : Math.round((values[m - 1] + values[m]) / 2);
}

/**
 * Sample a small region and return the per-channel **median** RGB. Median
 * is robust against the kind of localised outliers that wreck a mean:
 * specular highlights, JPEG ringing, anti-aliased cell edges, dust
 * specks. The radius defines a square window around (cx, cy).
 */
export function sampleCell(
  source: CanvasRenderingContext2D | ImageBuffer,
  cx: number,
  cy: number,
  radius: number,
): RGB {
  const buf: ImageBuffer =
    'data' in source
      ? source
      : (() => {
          const c = source.canvas;
          return {
            data: source.getImageData(0, 0, c.width, c.height).data,
            width: c.width,
            height: c.height,
          };
        })();

  const r = Math.max(1, Math.round(radius));
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(buf.width - 1, Math.floor(cx + r));
  const y1 = Math.min(buf.height - 1, Math.floor(cy + r));
  if (x1 < x0 || y1 < y0) return [128, 128, 128];

  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const rowOffset = y * buf.width * 4;
    for (let x = x0; x <= x1; x++) {
      const i = rowOffset + x * 4;
      rs.push(buf.data[i]);
      gs.push(buf.data[i + 1]);
      bs.push(buf.data[i + 2]);
    }
  }
  return [median(rs), median(gs), median(bs)];
}

/**
 * Build a per-photograph palette LUT from calibration samples.
 *
 * `calibrationSamples[i]` holds one or more observed RGBs for palette index `pattern[i]`.
 * Returns a 16-entry reference palette (mean observed RGB per index). Any palette index
 * with no calibration observations falls back to the canonical palette RGB.
 */
export function buildCalibrationLUT(
  pattern: number[],
  samples: RGB[],
): PaletteLUT {
  const buckets: Array<{ r: number; g: number; b: number; n: number }> = Array.from(
    { length: PALETTE.length },
    () => ({ r: 0, g: 0, b: 0, n: 0 }),
  );
  for (let i = 0; i < pattern.length && i < samples.length; i++) {
    const idx = pattern[i];
    const [r, g, b] = samples[i];
    buckets[idx].r += r;
    buckets[idx].g += g;
    buckets[idx].b += b;
    buckets[idx].n += 1;
  }
  return buckets.map((b, i) => {
    if (b.n === 0) return PALETTE[i].rgb;
    return [
      Math.round(b.r / b.n),
      Math.round(b.g / b.n),
      Math.round(b.b / b.n),
    ] as RGB;
  });
}
