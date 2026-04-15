import type { PatientData } from '../core/types';
import { PALETTE, TIER_COLOURS } from '../core/palette';
import { encodePatientData, dataToColorCells } from '../core/binary';
import {
  createLayout,
  NAME_BLOCK_CALIBRATION,
  NAME_BLOCK_COLS,
  NAME_BLOCK_ROWS,
} from '../core/glyph-layout';

/**
 * Render a v3.0 Mediglyph onto a canvas.
 *
 * Layout:
 *   Human zone: T0 + T1-T4 quadrant + 10×3 name/calibration block
 *   Machine zone: 16×5 pure colour data grid (no letter overlays)
 */
export function renderGlyph(
  canvas: HTMLCanvasElement,
  patient: PatientData,
): { encodedData: number[]; colorCells: number[] } {
  const ctx = canvas.getContext('2d')!;
  const L = createLayout(20);

  canvas.width = L.totalWidth;
  canvas.height = L.totalHeight;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawT0(ctx, L, patient);
  drawTierQuadrant(ctx, L, patient);
  drawCalibrationBlock(ctx, L);

  const encodedData = encodePatientData(patient);
  const colorCells = dataToColorCells(encodedData);
  drawDataGrid(ctx, L, colorCells);

  return { encodedData, colorCells };
}

function drawT0(
  ctx: CanvasRenderingContext2D,
  L: ReturnType<typeof createLayout>,
  patient: PatientData,
) {
  const active = patient.tier0.length > 0;
  ctx.fillStyle = active ? TIER_COLOURS[0] : TIER_COLOURS.inactive;
  ctx.beginPath();
  ctx.roundRect(L.t0X, L.t0Y, L.t0Size - 2, L.t0Size - 2, 4);
  ctx.fill();

  ctx.fillStyle = active ? '#FFFFFF' : '#888888';
  ctx.font = `bold ${L.pxPerMm * 0.6}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    active ? 'PAUSE' : 'T0',
    L.t0X + L.t0Size / 2 - 1,
    L.t0Y + L.t0Size / 2 - 1,
  );
}

function drawTierQuadrant(
  ctx: CanvasRenderingContext2D,
  L: ReturnType<typeof createLayout>,
  patient: PatientData,
) {
  const grid = [
    { tier: 1, col: 0, row: 0 },
    { tier: 2, col: 1, row: 0 },
    { tier: 3, col: 0, row: 1 },
    { tier: 4, col: 1, row: 1 },
  ] as const;

  for (const t of grid) {
    const tierKey = `tier${t.tier}` as keyof PatientData;
    const arr = (patient[tierKey] as string[]) || [];
    const hasPhone = t.tier === 4 && !!patient.phone;
    const active = arr.length > 0 || hasPhone;

    const tx = L.tQuadX + t.col * L.tSmallSize;
    const ty = L.tQuadY + t.row * L.tSmallSize;

    ctx.fillStyle = active ? TIER_COLOURS[t.tier] : TIER_COLOURS.inactive;
    ctx.beginPath();
    ctx.roundRect(tx, ty, L.tSmallSize - 2, L.tSmallSize - 2, 3);
    ctx.fill();

    ctx.fillStyle = active ? '#FFFFFF' : '#888888';
    ctx.font = `bold ${L.pxPerMm * 0.5}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`T${t.tier}`, tx + L.tSmallSize / 2 - 1, ty + L.tSmallSize / 2 - 1);
  }
}

/**
 * Draw the 30-cell calibration block. v3.0 carries no name inside the glyph —
 * the patient name is printed externally as normal typography alongside the
 * glyph by the physical product (bracelet, card, sticker). These 30 cells are
 * a fixed colour pattern covering every palette index, serving as the
 * decoder's per-photograph colour-correction reference.
 */
function drawCalibrationBlock(
  ctx: CanvasRenderingContext2D,
  L: ReturnType<typeof createLayout>,
) {
  for (let row = 0; row < NAME_BLOCK_ROWS; row++) {
    for (let col = 0; col < NAME_BLOCK_COLS; col++) {
      const idx = row * NAME_BLOCK_COLS + col;
      const paletteIdx = NAME_BLOCK_CALIBRATION[idx];
      const x = L.nameBlockX + col * L.nameBlockCellW;
      const y = L.nameBlockY + row * L.nameBlockCellH;

      ctx.fillStyle = PALETTE[paletteIdx].hex;
      ctx.fillRect(x + 0.5, y + 0.5, L.nameBlockCellW - 1, L.nameBlockCellH - 1);
    }
  }
}

function drawDataGrid(
  ctx: CanvasRenderingContext2D,
  L: ReturnType<typeof createLayout>,
  cells: number[],
) {
  for (let row = 0; row < L.dataGridRows; row++) {
    for (let col = 0; col < L.dataGridCols; col++) {
      const idx = row * L.dataGridCols + col;
      const paletteIdx = idx < cells.length ? cells[idx] : 0;
      const x = L.dataZoneX + col * L.dataCellSize;
      const y = L.dataZoneY + row * L.dataCellSize;

      ctx.fillStyle = PALETTE[paletteIdx].hex;
      ctx.fillRect(x + 0.5, y + 0.5, L.dataCellSize - 1, L.dataCellSize - 1);
    }
  }
}

/** SVG rendering of the same glyph. */
export function renderGlyphSVG(patient: PatientData): string {
  const L = createLayout(20);
  const encodedData = encodePatientData(patient);
  const colorCells = dataToColorCells(encodedData);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${L.totalWidth}" height="${L.totalHeight}" viewBox="0 0 ${L.totalWidth} ${L.totalHeight}">`,
  );
  parts.push(`<rect width="${L.totalWidth}" height="${L.totalHeight}" fill="#FFFFFF"/>`);

  // T0
  const t0Active = patient.tier0.length > 0;
  parts.push(
    `<rect x="${L.t0X}" y="${L.t0Y}" width="${L.t0Size - 2}" height="${L.t0Size - 2}" rx="4" fill="${t0Active ? TIER_COLOURS[0] : TIER_COLOURS.inactive}"/>`,
  );
  parts.push(
    `<text x="${L.t0X + L.t0Size / 2 - 1}" y="${L.t0Y + L.t0Size / 2}" text-anchor="middle" dominant-baseline="central" fill="${t0Active ? '#FFF' : '#888'}" font-size="${L.pxPerMm * 0.6}" font-weight="bold" font-family="sans-serif">${t0Active ? 'PAUSE' : 'T0'}</text>`,
  );

  // T1-T4
  const tiers = [
    { tier: 1, col: 0, row: 0 },
    { tier: 2, col: 1, row: 0 },
    { tier: 3, col: 0, row: 1 },
    { tier: 4, col: 1, row: 1 },
  ] as const;
  tiers.forEach((t) => {
    const arr = (patient[`tier${t.tier}` as keyof PatientData] as string[]) || [];
    const active = arr.length > 0 || (t.tier === 4 && !!patient.phone);
    const tx = L.tQuadX + t.col * L.tSmallSize;
    const ty = L.tQuadY + t.row * L.tSmallSize;
    parts.push(
      `<rect x="${tx}" y="${ty}" width="${L.tSmallSize - 2}" height="${L.tSmallSize - 2}" rx="3" fill="${active ? TIER_COLOURS[t.tier] : TIER_COLOURS.inactive}"/>`,
    );
    parts.push(
      `<text x="${tx + L.tSmallSize / 2 - 1}" y="${ty + L.tSmallSize / 2}" text-anchor="middle" dominant-baseline="central" fill="${active ? '#FFF' : '#888'}" font-size="${L.pxPerMm * 0.5}" font-weight="bold" font-family="sans-serif">T${t.tier}</text>`,
    );
  });

  // Calibration block (no letters — name is printed externally)
  for (let row = 0; row < NAME_BLOCK_ROWS; row++) {
    for (let col = 0; col < NAME_BLOCK_COLS; col++) {
      const idx = row * NAME_BLOCK_COLS + col;
      const paletteIdx = NAME_BLOCK_CALIBRATION[idx];
      const x = L.nameBlockX + col * L.nameBlockCellW;
      const y = L.nameBlockY + row * L.nameBlockCellH;
      parts.push(
        `<rect x="${x + 0.5}" y="${y + 0.5}" width="${L.nameBlockCellW - 1}" height="${L.nameBlockCellH - 1}" fill="${PALETTE[paletteIdx].hex}"/>`,
      );
    }
  }

  // Data grid
  for (let row = 0; row < L.dataGridRows; row++) {
    for (let col = 0; col < L.dataGridCols; col++) {
      const idx = row * L.dataGridCols + col;
      const paletteIdx = idx < colorCells.length ? colorCells[idx] : 0;
      const x = L.dataZoneX + col * L.dataCellSize;
      const y = L.dataZoneY + row * L.dataCellSize;
      parts.push(
        `<rect x="${x + 0.5}" y="${y + 0.5}" width="${L.dataCellSize - 1}" height="${L.dataCellSize - 1}" fill="${PALETTE[paletteIdx].hex}"/>`,
      );
    }
  }

  parts.push('</svg>');
  return parts.join('');
}
