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
  type ImageBuffer,
  type PaletteLUT,
  type RGB,
} from './classify-color';
import { preprocessImage } from './preprocess';

interface ContentBounds {
  found: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * v3.0 decode pipeline:
 *   0. Preprocess: estimate background + rotation, de-rotate the canvas
 *      so the glyph is horizontal. Cache one ImageData buffer for the
 *      whole pipeline.
 *   1. Find content bounds (saturated core + outward expand to pick up
 *      Black/White/Grey palette cells at glyph edges).
 *   2. Derive layout from the 24×14mm proportions.
 *   3. Sample calibration cells in the name block → build per-glyph LUT.
 *   4. Sample the 16×5 data grid against the LUT.
 *   5. Decode binary payload + verify CRC.
 */
export function decodeFromImage(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): DecodedResult {
  const pre = preprocessImage(canvas, ctx);
  const buf: ImageBuffer = { data: pre.data, width: pre.width, height: pre.height };

  const bounds = findContentBounds(buf, pre.background);
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
  const humanZone = sampleHumanZone(buf, t0X, t0Y, tQuadX, tQuadY, t0Size, tSmallSize);

  // Sample name-block calibration cells → build LUT
  const calibSamples = sampleNameBlockCalibration(
    buf,
    nameBlockX,
    nameBlockY,
    nameBlockCellW,
    nameBlockCellH,
  );
  const lut = buildCalibrationLUT(NAME_BLOCK_CALIBRATION, calibSamples);

  // Sample data grid against the LUT
  const { nibbles, confidence } = sampleDataZone(
    buf,
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
    rotation: pre.rotation,
    background: pre.background,
    // Hand the rotated canvas back so external-name OCR crops from the same
    // de-rotated frame the decoder used. Otherwise the bounds would point at
    // the wrong region of the original photo.
    preprocessedCanvas: pre.canvas,
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

/**
 * Two-pass bounds detector:
 *
 *   1. Saturated pass — bounds the highly chromatic pixels that can only
 *      come from the colour palette (greyscale text and faint backgrounds
 *      have low chroma and are ignored).
 *   2. Expand pass — walks outward one row/column at a time to absorb
 *      Black/White/Grey/Silver palette cells at the glyph edges, stopping
 *      at the first "all background" row/column. The white gap between
 *      the printed name label (in v3.0 exports) and the glyph terminates
 *      the expansion cleanly.
 *
 * The "ink" predicate is adaptive: anything noticeably darker than the
 * estimated photo background counts. That keeps us robust to off-white
 * paper, screen captures, and slightly tinted prints.
 */
function findContentBounds(
  buf: ImageBuffer,
  background: { r: number; g: number; b: number },
): ContentBounds {
  const { data, width, height } = buf;

  // Pass 1: saturated bounds
  let sMinX = width, sMinY = height, sMaxX = 0, sMaxY = 0;
  let found = false;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = row + x * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (chroma >= 40) {
        found = true;
        if (x < sMinX) sMinX = x;
        if (y < sMinY) sMinY = y;
        if (x > sMaxX) sMaxX = x;
        if (y > sMaxY) sMaxY = y;
      }
    }
  }
  if (!found) return { found: false, minX: 0, minY: 0, maxX: 0, maxY: 0 };

  // Adaptive "is ink" threshold — at least 25 levels darker than the bg
  // mean luma, OR chromatic. Handles non-pure-white paper.
  const bgLuma = (background.r + background.g + background.b) / 3;
  const inkLuma = Math.max(0, bgLuma - 25);
  const isInk = (x: number, y: number): boolean => {
    const i = (y * width + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    if (chroma >= 25) return true;
    return (r + g + b) / 3 < inkLuma;
  };
  const rowHasInk = (y: number, x0: number, x1: number): boolean => {
    for (let x = x0; x <= x1; x++) if (isInk(x, y)) return true;
    return false;
  };
  const colHasInk = (x: number, y0: number, y1: number): boolean => {
    for (let y = y0; y <= y1; y++) if (isInk(x, y)) return true;
    return false;
  };

  // Pass 2: expand to grab edge B&W cells
  let minX = sMinX, minY = sMinY, maxX = sMaxX, maxY = sMaxY;
  while (minY > 0 && rowHasInk(minY - 1, sMinX, sMaxX)) minY--;
  while (maxY < height - 1 && rowHasInk(maxY + 1, sMinX, sMaxX)) maxY++;
  while (minX > 0 && colHasInk(minX - 1, minY, maxY)) minX--;
  while (maxX < width - 1 && colHasInk(maxX + 1, minY, maxY)) maxX++;

  return { found: true, minX, minY, maxX, maxY };
}

function sampleHumanZone(
  buf: ImageBuffer,
  t0X: number,
  t0Y: number,
  tQuadX: number,
  tQuadY: number,
  t0Size: number,
  tSmallSize: number,
): HumanZoneResult {
  const t0Sample = sampleCell(buf, t0X + t0Size / 2, t0Y + t0Size / 2, t0Size * 0.25);
  const t1Sample = sampleCell(buf, tQuadX + tSmallSize * 0.5, tQuadY + tSmallSize * 0.5, tSmallSize * 0.3);
  const t2Sample = sampleCell(buf, tQuadX + tSmallSize * 1.5, tQuadY + tSmallSize * 0.5, tSmallSize * 0.3);
  const t3Sample = sampleCell(buf, tQuadX + tSmallSize * 0.5, tQuadY + tSmallSize * 1.5, tSmallSize * 0.3);
  const t4Sample = sampleCell(buf, tQuadX + tSmallSize * 1.5, tQuadY + tSmallSize * 1.5, tSmallSize * 0.3);

  return {
    tier0: matchTierColor(t0Sample, 0).active,
    tier1: matchTierColor(t1Sample, 1).active,
    tier2: matchTierColor(t2Sample, 2).active,
    tier3: matchTierColor(t3Sample, 3).active,
    tier4: matchTierColor(t4Sample, 4).active,
  };
}

/**
 * Sample the 30 name-block calibration cells with median sampling at four
 * corner insets. Sampling near the corners keeps us inside the cell even
 * if the glyph has slight perspective distortion the rotation step did
 * not fully correct.
 */
function sampleNameBlockCalibration(
  buf: ImageBuffer,
  startX: number,
  startY: number,
  cellW: number,
  cellH: number,
): RGB[] {
  const samples: RGB[] = [];
  const r = Math.max(1, Math.min(cellW, cellH) * 0.18);

  const offsets: Array<[number, number]> = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
    [0.5, 0.5],
  ];

  for (let row = 0; row < NAME_BLOCK_ROWS; row++) {
    for (let col = 0; col < NAME_BLOCK_COLS; col++) {
      const cx = startX + col * cellW;
      const cy = startY + row * cellH;
      const corners = offsets.map(([ox, oy]) =>
        sampleCell(buf, cx + cellW * ox, cy + cellH * oy, r),
      );
      // Mean of the (already median-per-region) samples
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

/**
 * Sample the 16×5 data grid. For every cell we sample the LUT at several
 * interior offsets, classify each one against the per-photograph LUT,
 * and run a vote: cells where multiple internal samples agree carry more
 * weight, ties break on tightest distance.
 */
function sampleDataZone(
  buf: ImageBuffer,
  startX: number,
  startY: number,
  cellSize: number,
  lut: PaletteLUT,
): { nibbles: number[]; confidence: number } {
  const nibbles: number[] = [];
  const confidences: number[] = [];

  // Nine interior sample points (3×3 grid inset 25% from cell edges) plus
  // the centre. More samples = more outlier resilience.
  const sampleOffsets: Array<[number, number]> = [
    [0.30, 0.30], [0.50, 0.30], [0.70, 0.30],
    [0.30, 0.50], [0.50, 0.50], [0.70, 0.50],
    [0.30, 0.70], [0.50, 0.70], [0.70, 0.70],
  ];
  const radius = Math.max(1, cellSize * 0.07);

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 16; col++) {
      const cellX = startX + col * cellSize;
      const cellY = startY + row * cellSize;

      const votes = new Map<number, { count: number; totalDist: number; confidence: number }>();
      for (const [ox, oy] of sampleOffsets) {
        const sample = sampleCell(buf, cellX + cellSize * ox, cellY + cellSize * oy, radius);
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
