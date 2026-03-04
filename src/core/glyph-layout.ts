import type { GlyphLayout } from './types';

/** Create the standard glyph layout at a given scale */
export function createLayout(pxPerMm: number = 20): GlyphLayout {
  const totalWidth = 18 * pxPerMm;
  const totalHeight = 10 * pxPerMm;
  const quietZone = 0.75 * pxPerMm;

  const t0Size = 3 * pxPerMm;
  const tSmallSize = 1.5 * pxPerMm;
  const humanZoneWidth = t0Size + tSmallSize * 2; // 6mm
  const humanZoneHeight = t0Size; // 3mm

  const dataGridCols = 12;
  const dataGridRows = 4;
  const usableWidth = (18 - 1.5) * pxPerMm; // 16.5mm
  const dataCellSize = usableWidth / dataGridCols;

  const dataZoneX = quietZone;
  const dataZoneY = quietZone + humanZoneHeight + quietZone * 0.5;

  return {
    pxPerMm,
    totalWidth,
    totalHeight,
    quietZone,
    t0Size,
    tSmallSize,
    humanZoneWidth,
    humanZoneHeight,
    dataGridCols,
    dataGridRows,
    dataCellSize,
    dataZoneX,
    dataZoneY,
  };
}
