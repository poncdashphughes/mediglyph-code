import type { GlyphLayout } from './types';

/**
 * v3.0 glyph layout — 24mm × 14mm watch-strap geometry.
 *
 * Human zone (top):
 *   - T0 big square (3×3mm) on the left
 *   - T1-T4 quadrant (3×3mm, 2×2 of 1.5mm cells)
 *   - Name block (15×3mm, 10×3 cells at 1.5×1mm)
 *
 * Machine zone (bottom):
 *   - 16×5 data grid, ~1.375×1.375mm cells
 */

/** Fixed calibration colour pattern for the 30 name-block cells (row-major, 10 cols × 3 rows). */
export const NAME_BLOCK_CALIBRATION: number[] = [
  0,  8,  1,  9,  2, 10,  3, 11,  4, 12,
  5, 13,  6, 14,  7, 15,  0,  8,  1,  9,
 10,  2, 11,  3, 12,  4, 13,  5, 14,  6,
];

export const NAME_BLOCK_COLS = 10;
export const NAME_BLOCK_ROWS = 3;
export const NAME_BLOCK_MAX_CHARS = NAME_BLOCK_COLS * NAME_BLOCK_ROWS;

export interface V3Layout extends GlyphLayout {
  // Human zone
  t0X: number;
  t0Y: number;
  tQuadX: number;
  tQuadY: number;
  nameBlockX: number;
  nameBlockY: number;
  nameBlockCellW: number;
  nameBlockCellH: number;
  nameBlockWidth: number;
  nameBlockHeight: number;
}

export function createLayout(pxPerMm: number = 20): V3Layout {
  const totalWidthMm = 24;
  const totalHeightMm = 14;
  const quietMm = 1;

  const t0Mm = 3;
  const tSmallMm = 1.5;
  const tQuadMm = tSmallMm * 2; // 3mm
  const humanZoneHeightMm = 3;

  const nameCellWMm = 1.5;
  const nameCellHMm = 1.0;
  const nameBlockWidthMm = NAME_BLOCK_COLS * nameCellWMm; // 15mm
  const nameBlockHeightMm = NAME_BLOCK_ROWS * nameCellHMm; // 3mm

  // Data grid: spans full usable width
  const dataGridCols = 16;
  const dataGridRows = 5;
  const usableWidthMm = totalWidthMm - quietMm * 2; // 22mm
  const dataCellMm = usableWidthMm / dataGridCols; // 1.375mm

  const totalWidth = totalWidthMm * pxPerMm;
  const totalHeight = totalHeightMm * pxPerMm;
  const quietZone = quietMm * pxPerMm;
  const t0Size = t0Mm * pxPerMm;
  const tSmallSize = tSmallMm * pxPerMm;

  // Human-zone layout: left to right
  const t0X = quietZone;
  const t0Y = quietZone;

  const gap = 0.5 * pxPerMm;
  const tQuadX = t0X + t0Size + gap;
  const tQuadY = quietZone;

  const nameBlockX = tQuadX + tQuadMm * pxPerMm + gap;
  const nameBlockY = quietZone;
  const nameBlockCellW = nameCellWMm * pxPerMm;
  const nameBlockCellH = nameCellHMm * pxPerMm;
  const nameBlockWidth = nameBlockWidthMm * pxPerMm;
  const nameBlockHeight = nameBlockHeightMm * pxPerMm;

  // Data zone: below human zone, full width
  const dataZoneX = quietZone;
  const dataZoneY = quietZone + humanZoneHeightMm * pxPerMm + 0.5 * pxPerMm;
  const dataCellSize = dataCellMm * pxPerMm;

  return {
    pxPerMm,
    totalWidth,
    totalHeight,
    quietZone,
    t0Size,
    tSmallSize,
    humanZoneWidth: totalWidth - quietZone * 2,
    humanZoneHeight: humanZoneHeightMm * pxPerMm,
    dataGridCols,
    dataGridRows,
    dataCellSize,
    dataZoneX,
    dataZoneY,
    t0X,
    t0Y,
    tQuadX,
    tQuadY,
    nameBlockX,
    nameBlockY,
    nameBlockCellW,
    nameBlockCellH,
    nameBlockWidth,
    nameBlockHeight,
  };
}
