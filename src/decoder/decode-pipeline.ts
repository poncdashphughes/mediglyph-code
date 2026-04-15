import type { DecodedResult, HumanZoneResult } from '../core/types';
import { decodeColorData } from '../core/binary';
import {
  NAME_BLOCK_CALIBRATION,
  NAME_BLOCK_COLS,
  NAME_BLOCK_ROWS,
} from '../core/glyph-layout';
import {
  buildCalibrationLUT,
  matchTierColor,
  matchToReference,
  sampleCell,
  type PaletteLUT,
  type RGB,
} from './classify-color';

interface ContentBounds {
  found: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * v3.0 decode pipeline:
 *   1. Find content bounds.
 *   2. Derive layout from the 24×14mm proportions.
 *   3. Sample calibration cells in the name block → build per-glyph LUT.
 *   4. Sample the 16×5 data grid against the LUT.
 *   5. Decode binary payload + verify CRC.
 */
export function decodeFromImage(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): DecodedResult {
  const bounds = findContentBounds(ctx, canvas.width, canvas.height);
  if (!bounds.found) {
    return emptyResult('Could not find glyph content');
  }

  // Proportions of the v3.0 22mm-usable-wide glyph
  const contentWidth = bounds.maxX - bounds.minX;
  const mmPerPx = 22 / contentWidth; // usable width is 22mm (content-bounded)
  const pxPerMm = 1 / mmPerPx;

  // Layout metrics derived from content bounds (content starts inside the quiet zone)
  const t0Size = 3 * pxPerMm;
  const tSmallSize = 1.5 * pxPerMm;
  const gap = 0.5 * pxPerMm;

  const t0X = bounds.minX;
  const t0Y = bounds.minY;
  const tQuadX = t0X + t0Size + gap;
  const tQuadY = bounds.minY;

  const nameBlockX = tQuadX + tSmallSize * 2 + gap;
  const nameBlockY = bounds.minY;
  const nameBlockCellW = 1.5 * pxPerMm;
  const nameBlockCellH = 1.0 * pxPerMm;

  const humanZoneHeight = 3 * pxPerMm;
  const dataZoneX = bounds.minX;
  const dataZoneY = bounds.minY + humanZoneHeight + 0.5 * pxPerMm;
  const dataCellSize = contentWidth / 16;

  // Sample human-zone triage indicators
  const humanZone = sampleHumanZone(ctx, t0X, t0Y, tQuadX, tQuadY, t0Size, tSmallSize);

  // Sample name-block calibration cells → build LUT
  const calibSamples = sampleNameBlockCalibration(
    ctx,
    nameBlockX,
    nameBlockY,
    nameBlockCellW,
    nameBlockCellH,
  );
  const lut = buildCalibrationLUT(NAME_BLOCK_CALIBRATION, calibSamples);

  // Sample data grid against the LUT
  const { nibbles, confidence } = sampleDataZone(
    ctx,
    dataZoneX,
    dataZoneY,
    dataCellSize,
    lut,
  );

  const decoded = decodeColorData(nibbles);
  decoded.humanZone = humanZone;
  // v3.0: name is printed externally. UI may call readExternalName() to OCR
  // the region above the glyph after the fast data-decode has been shown.
  decoded.name = '';

  decoded.debug = {
    ...(decoded.debug || {}),
    bounds,
    layout: { t0Size, tSmallSize, dataCellSize, nameBlockCellW, nameBlockCellH },
    confidence,
    lut,
  };
  return decoded;
}

function emptyResult(error: string): DecodedResult {
  return {
    version: 0,
    flags: 0,
    name: '',
    dob: '',
    blood: 'Unknown',
    tier0: [],
    tier1: [],
    tier2: [],
    tier3: [],
    phone: '',
    error,
  };
}

function findContentBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): ContentBounds {
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx] < 245 || data[idx + 1] < 245 || data[idx + 2] < 245) {
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
  t0X: number,
  t0Y: number,
  tQuadX: number,
  tQuadY: number,
  t0Size: number,
  tSmallSize: number,
): HumanZoneResult {
  const t0Sample = sampleCell(ctx, t0X + t0Size / 2, t0Y + t0Size / 2, t0Size * 0.25);
  const t1Sample = sampleCell(ctx, tQuadX + tSmallSize * 0.5, tQuadY + tSmallSize * 0.5, tSmallSize * 0.3);
  const t2Sample = sampleCell(ctx, tQuadX + tSmallSize * 1.5, tQuadY + tSmallSize * 0.5, tSmallSize * 0.3);
  const t3Sample = sampleCell(ctx, tQuadX + tSmallSize * 0.5, tQuadY + tSmallSize * 1.5, tSmallSize * 0.3);
  const t4Sample = sampleCell(ctx, tQuadX + tSmallSize * 1.5, tQuadY + tSmallSize * 1.5, tSmallSize * 0.3);

  return {
    tier0: matchTierColor(t0Sample, 0).active,
    tier1: matchTierColor(t1Sample, 1).active,
    tier2: matchTierColor(t2Sample, 2).active,
    tier3: matchTierColor(t3Sample, 3).active,
    tier4: matchTierColor(t4Sample, 4).active,
  };
}

/**
 * Sample the 30 name-block cells. Each cell has a letter (or space) overlaid on a
 * calibration-coloured background. Sample the four corners — letter strokes sit in
 * the centre, so corners read the pure cell fill.
 */
function sampleNameBlockCalibration(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  cellW: number,
  cellH: number,
): RGB[] {
  const samples: RGB[] = [];
  const r = Math.max(1, Math.min(cellW, cellH) * 0.12);

  // Four corner offsets, inset from the cell edge
  const offsets: Array<[number, number]> = [
    [0.15, 0.15],
    [0.85, 0.15],
    [0.15, 0.85],
    [0.85, 0.85],
  ];

  for (let row = 0; row < NAME_BLOCK_ROWS; row++) {
    for (let col = 0; col < NAME_BLOCK_COLS; col++) {
      const cx = startX + col * cellW;
      const cy = startY + row * cellH;
      const corners = offsets.map(([ox, oy]) =>
        sampleCell(ctx, cx + cellW * ox, cy + cellH * oy, r),
      );
      // Mean of the four corner samples
      const mean: RGB = [
        Math.round(corners.reduce((s, c) => s + c[0], 0) / corners.length),
        Math.round(corners.reduce((s, c) => s + c[1], 0) / corners.length),
        Math.round(corners.reduce((s, c) => s + c[2], 0) / corners.length),
      ];
      samples.push(mean);
    }
  }
  return samples;
}

function sampleDataZone(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  cellSize: number,
  lut: PaletteLUT,
): { nibbles: number[]; confidence: number } {
  const nibbles: number[] = [];
  const confidences: number[] = [];

  // 6 interior sample points, avoiding cell edges and anti-aliasing
  const sampleOffsets: Array<[number, number]> = [
    [0.3, 0.3], [0.7, 0.3],
    [0.3, 0.7], [0.7, 0.7],
    [0.5, 0.25], [0.5, 0.75],
  ];
  const radius = Math.max(1.5, cellSize * 0.06);

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 16; col++) {
      const cellX = startX + col * cellSize;
      const cellY = startY + row * cellSize;

      const votes = new Map<number, { count: number; totalDist: number; confidence: number }>();
      for (const [ox, oy] of sampleOffsets) {
        const sample = sampleCell(ctx, cellX + cellSize * ox, cellY + cellSize * oy, radius);
        const match = matchToReference(sample, lut);
        const existing = votes.get(match.index);
        if (existing) {
          existing.count++;
          existing.totalDist += match.distance;
          existing.confidence = Math.max(existing.confidence, match.confidence);
        } else {
          votes.set(match.index, { count: 1, totalDist: match.distance, confidence: match.confidence });
        }
      }

      let bestIndex = 0;
      let bestCount = 0;
      let bestAvgDist = Infinity;
      let bestConfidence = 0;
      for (const [index, v] of votes) {
        const avgDist = v.totalDist / v.count;
        if (v.count > bestCount || (v.count === bestCount && avgDist < bestAvgDist)) {
          bestIndex = index;
          bestCount = v.count;
          bestAvgDist = avgDist;
          bestConfidence = v.confidence;
        }
      }
      nibbles.push(bestIndex);
      confidences.push(bestConfidence);
    }
  }

  const avgConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;
  return { nibbles, confidence: avgConfidence };
}
