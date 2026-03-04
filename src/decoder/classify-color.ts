import { PALETTE, TIER_RGB, colorDistance } from '../core/palette';
import type { ColourMatch } from '../core/types';

/** Match an RGB sample to the closest palette colour */
export function matchToPalette(sample: number[]): ColourMatch {
  let bestIndex = 0;
  let bestDist = Infinity;

  for (let i = 0; i < PALETTE.length; i++) {
    const dist = colorDistance(sample, PALETTE[i].rgb);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }

  const confidence = bestDist < 30 ? 1.0 : bestDist < 60 ? 0.8 : bestDist < 100 ? 0.5 : 0.2;
  return { index: bestIndex, distance: bestDist, confidence, color: PALETTE[bestIndex].name };
}

/** Check if an RGB sample matches a tier's active or inactive colour */
export function matchTierColor(sample: number[], tier: number): { valid: boolean; active: boolean } {
  const activeRgb = TIER_RGB[tier];
  const inactiveRgb = TIER_RGB.inactive;

  const distToActive = colorDistance(sample, activeRgb);
  const distToInactive = colorDistance(sample, inactiveRgb);

  const valid = distToActive < 100 || distToInactive < 100;
  const active = distToActive < distToInactive && distToActive < 100;

  return { valid, active };
}

/** Sample a small region of pixels and return the average RGB */
export function sampleCell(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): [number, number, number] {
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
        } catch { /* ignore out of bounds */ }
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
