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

/** Sample a small region and return the mean RGB. */
export function sampleCell(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): RGB {
  const samples: number[][] = [];
  const step = Math.max(1, radius / 2);
  for (let dy = -radius; dy <= radius; dy += step) {
    for (let dx = -radius; dx <= radius; dx += step) {
      const x = Math.floor(cx + dx);
      const y = Math.floor(cy + dy);
      if (x >= 0 && y >= 0) {
        try {
          const data = ctx.getImageData(x, y, 1, 1).data;
          samples.push([data[0], data[1], data[2]]);
        } catch { /* out of bounds */ }
      }
    }
  }
  if (samples.length === 0) return [128, 128, 128];
  return [
    Math.round(samples.reduce((s, c) => s + c[0], 0) / samples.length),
    Math.round(samples.reduce((s, c) => s + c[1], 0) / samples.length),
    Math.round(samples.reduce((s, c) => s + c[2], 0) / samples.length),
  ];
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
