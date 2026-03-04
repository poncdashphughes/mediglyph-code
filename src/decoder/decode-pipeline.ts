import type { DecodedResult, HumanZoneResult } from '../core/types';
import { decodeColorData } from '../core/binary';
import { sampleCell, matchToPalette, matchTierColor } from './classify-color';

interface ContentBounds {
  found: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Full decode pipeline: image → patient data */
export function decodeFromImage(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): DecodedResult {
  const width = canvas.width;
  const height = canvas.height;

  // Step 1: Find content bounds
  const bounds = findContentBounds(ctx, width, height);
  if (!bounds.found) {
    return { version: 0, flags: 0, name: '', dob: '', blood: 'Unknown', tier0: [], tier1: [], tier2: [], tier3: [], phone: '', error: 'Could not find glyph content' };
  }

  // Step 2: Calculate layout proportions
  const contentWidth = bounds.maxX - bounds.minX;
  const t0Size = contentWidth * (3 / 16.5);
  const tSmallSize = contentWidth * (1.5 / 16.5);
  const humanZoneHeight = t0Size;
  const dataZoneY = bounds.minY + humanZoneHeight + contentWidth * (0.5 / 16.5);
  const dataCellSize = contentWidth / 12;

  // Step 3: Sample Human Zone
  const humanZone = sampleHumanZone(ctx, bounds.minX, bounds.minY, t0Size, tSmallSize);

  // Step 4: Sample Data Zone
  const dataZone = sampleDataZone(ctx, bounds.minX, dataZoneY, dataCellSize);

  // Step 5: Decode
  const decoded = decodeColorData(dataZone.nibbles);
  decoded.humanZone = humanZone;
  decoded.debug = {
    bounds,
    layout: { t0Size, tSmallSize, dataZoneY, dataCellSize },
    confidence: dataZone.confidence,
  };

  return decoded;
}

function findContentBounds(ctx: CanvasRenderingContext2D, width: number, height: number): ContentBounds {
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (r < 245 || g < 245 || b < 245) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  return { found, minX, minY, maxX, maxY };
}

function sampleHumanZone(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  t0Size: number,
  tSmallSize: number,
): HumanZoneResult {
  const result: HumanZoneResult = { tier0: false, tier1: false, tier2: false, tier3: false, tier4: false };

  const t0Sample = sampleCell(ctx, startX + t0Size / 2, startY + t0Size / 2, t0Size * 0.3);
  result.tier0 = matchTierColor(t0Sample, 0).active;

  const gridX = startX + t0Size;
  const gridY = startY;

  const t1Sample = sampleCell(ctx, gridX + tSmallSize * 0.5, gridY + tSmallSize * 0.5, tSmallSize * 0.3);
  const t2Sample = sampleCell(ctx, gridX + tSmallSize * 1.5, gridY + tSmallSize * 0.5, tSmallSize * 0.3);
  const t3Sample = sampleCell(ctx, gridX + tSmallSize * 0.5, gridY + tSmallSize * 1.5, tSmallSize * 0.3);
  const t4Sample = sampleCell(ctx, gridX + tSmallSize * 1.5, gridY + tSmallSize * 1.5, tSmallSize * 0.3);

  result.tier1 = matchTierColor(t1Sample, 1).active;
  result.tier2 = matchTierColor(t2Sample, 2).active;
  result.tier3 = matchTierColor(t3Sample, 3).active;
  result.tier4 = matchTierColor(t4Sample, 4).active;

  return result;
}

function sampleDataZone(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  cellSize: number,
): { nibbles: number[]; confidence: number } {
  const nibbles: number[] = [];
  const confidences: number[] = [];

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 12; col++) {
      const cellX = startX + col * cellSize;
      const cellY = startY + row * cellSize;

      // Sample 4 corners (avoiding center text overlay)
      const cornerOffsets: [number, number][] = [
        [0.12, 0.12], [0.88, 0.12],
        [0.12, 0.88], [0.88, 0.88],
      ];

      let bestMatch = { index: 0, distance: Infinity, confidence: 0, color: '' };

      for (const [ox, oy] of cornerOffsets) {
        const sample = sampleCell(ctx, cellX + cellSize * ox, cellY + cellSize * oy, cellSize * 0.08);
        const match = matchToPalette(sample);
        if (match.distance < bestMatch.distance) {
          bestMatch = match;
        }
      }

      nibbles.push(bestMatch.index);
      confidences.push(bestMatch.confidence);
    }
  }

  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  return { nibbles, confidence: avgConfidence };
}
