import type { PatientData } from '../core/types';
import { PALETTE, TIER_COLOURS, getLuminance } from '../core/palette';
import { encodePatientData, dataToColorCells } from '../core/binary';
import { createLayout } from '../core/glyph-layout';

/**
 * Render a Mediglyph onto a canvas.
 * Returns the canvas and the encoded data bytes for debug/export.
 */
export function renderGlyph(
  canvas: HTMLCanvasElement,
  patient: PatientData,
): { encodedData: number[]; colorCells: number[] } {
  const ctx = canvas.getContext('2d')!;
  const L = createLayout(20);

  canvas.width = L.totalWidth;
  canvas.height = L.totalHeight;

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ── HUMAN ZONE ──
  const hzX = L.quietZone;
  const hzY = L.quietZone;

  // T0 (large, top-left)
  const t0Active = patient.tier0.length > 0;
  ctx.fillStyle = t0Active ? TIER_COLOURS[0] : TIER_COLOURS.inactive;
  ctx.beginPath();
  ctx.roundRect(hzX, hzY, L.t0Size - 2, L.t0Size - 2, 4);
  ctx.fill();

  // T0 label
  ctx.fillStyle = t0Active ? '#FFFFFF' : '#888888';
  ctx.font = `bold ${L.pxPerMm * 0.6}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t0Active ? 'PAUSE' : 'T0', hzX + L.t0Size / 2 - 1, hzY + L.t0Size / 2 - 1);

  // T1-T4 (2x2 grid)
  const tierGrid = [
    { tier: 1, col: 0, row: 0 },
    { tier: 2, col: 1, row: 0 },
    { tier: 3, col: 0, row: 1 },
    { tier: 4, col: 1, row: 1 },
  ] as const;

  tierGrid.forEach(t => {
    const tierKey = `tier${t.tier}` as keyof PatientData;
    const tierData = (patient[tierKey] as string[]) || [];
    const hasPhone = t.tier === 4 && patient.phone;
    const isActive = tierData.length > 0 || !!hasPhone;

    const tx = hzX + L.t0Size + t.col * L.tSmallSize;
    const ty = hzY + t.row * L.tSmallSize;

    ctx.fillStyle = isActive ? TIER_COLOURS[t.tier] : TIER_COLOURS.inactive;
    ctx.beginPath();
    ctx.roundRect(tx, ty, L.tSmallSize - 2, L.tSmallSize - 2, 3);
    ctx.fill();

    ctx.fillStyle = isActive ? '#FFFFFF' : '#888888';
    ctx.font = `bold ${L.pxPerMm * 0.5}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`T${t.tier}`, tx + L.tSmallSize / 2 - 1, ty + L.tSmallSize / 2 - 1);
  });

  // ── DATA ZONE ──
  const encodedData = encodePatientData(patient);
  const colorCells = dataToColorCells(encodedData);
  const nameUpper = patient.name.toUpperCase().substring(0, 12);

  for (let row = 0; row < L.dataGridRows; row++) {
    for (let col = 0; col < L.dataGridCols; col++) {
      const idx = row * L.dataGridCols + col;
      const colorIdx = idx < colorCells.length ? colorCells[idx] : 14;

      const x = L.dataZoneX + col * L.dataCellSize;
      const y = L.dataZoneY + row * L.dataCellSize;

      // Cell background
      ctx.fillStyle = PALETTE[colorIdx].hex;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, L.dataCellSize - 2, L.dataCellSize - 2, 2);
      ctx.fill();

      // Character overlay
      let char = '';
      if (row === 0 && col < nameUpper.length) {
        char = nameUpper[col];
      } else {
        char = colorIdx.toString(16).toUpperCase();
      }

      const lum = getLuminance(PALETTE[colorIdx].rgb);
      ctx.fillStyle = lum > 0.5 ? '#000000' : '#FFFFFF';
      ctx.font = `bold ${L.dataCellSize * 0.5}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char, x + L.dataCellSize / 2, y + L.dataCellSize / 2 + 1);
    }
  }

  return { encodedData, colorCells };
}

/** Export glyph as SVG string */
export function renderGlyphSVG(patient: PatientData): string {
  const L = createLayout(20);
  const encodedData = encodePatientData(patient);
  const colorCells = dataToColorCells(encodedData);
  const nameUpper = patient.name.toUpperCase().substring(0, 12);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${L.totalWidth}" height="${L.totalHeight}" viewBox="0 0 ${L.totalWidth} ${L.totalHeight}">`;
  svg += `<rect width="${L.totalWidth}" height="${L.totalHeight}" fill="#FFFFFF"/>`;

  const hzX = L.quietZone;
  const hzY = L.quietZone;

  // T0
  const t0Active = patient.tier0.length > 0;
  svg += `<rect x="${hzX}" y="${hzY}" width="${L.t0Size - 2}" height="${L.t0Size - 2}" rx="4" fill="${t0Active ? TIER_COLOURS[0] : TIER_COLOURS.inactive}"/>`;
  svg += `<text x="${hzX + L.t0Size / 2 - 1}" y="${hzY + L.t0Size / 2}" text-anchor="middle" dominant-baseline="central" fill="${t0Active ? '#FFF' : '#888'}" font-size="${L.pxPerMm * 0.6}" font-weight="bold" font-family="sans-serif">${t0Active ? 'PAUSE' : 'T0'}</text>`;

  // T1-T4
  const tierGrid = [
    { tier: 1, col: 0, row: 0 },
    { tier: 2, col: 1, row: 0 },
    { tier: 3, col: 0, row: 1 },
    { tier: 4, col: 1, row: 1 },
  ] as const;

  tierGrid.forEach(t => {
    const tierKey = `tier${t.tier}` as keyof PatientData;
    const tierData = (patient[tierKey] as string[]) || [];
    const isActive = tierData.length > 0 || (t.tier === 4 && !!patient.phone);
    const tx = hzX + L.t0Size + t.col * L.tSmallSize;
    const ty = hzY + t.row * L.tSmallSize;
    svg += `<rect x="${tx}" y="${ty}" width="${L.tSmallSize - 2}" height="${L.tSmallSize - 2}" rx="3" fill="${isActive ? TIER_COLOURS[t.tier] : TIER_COLOURS.inactive}"/>`;
    svg += `<text x="${tx + L.tSmallSize / 2 - 1}" y="${ty + L.tSmallSize / 2}" text-anchor="middle" dominant-baseline="central" fill="${isActive ? '#FFF' : '#888'}" font-size="${L.pxPerMm * 0.5}" font-weight="bold" font-family="sans-serif">T${t.tier}</text>`;
  });

  // Data cells
  for (let row = 0; row < L.dataGridRows; row++) {
    for (let col = 0; col < L.dataGridCols; col++) {
      const idx = row * L.dataGridCols + col;
      const colorIdx = idx < colorCells.length ? colorCells[idx] : 14;
      const x = L.dataZoneX + col * L.dataCellSize;
      const y = L.dataZoneY + row * L.dataCellSize;

      svg += `<rect x="${x + 1}" y="${y + 1}" width="${L.dataCellSize - 2}" height="${L.dataCellSize - 2}" rx="2" fill="${PALETTE[colorIdx].hex}"/>`;

      let char = '';
      if (row === 0 && col < nameUpper.length) {
        char = nameUpper[col];
      } else {
        char = colorIdx.toString(16).toUpperCase();
      }

      const lum = getLuminance(PALETTE[colorIdx].rgb);
      svg += `<text x="${x + L.dataCellSize / 2}" y="${y + L.dataCellSize / 2 + 1}" text-anchor="middle" dominant-baseline="central" fill="${lum > 0.5 ? '#000' : '#FFF'}" font-size="${L.dataCellSize * 0.5}" font-weight="bold" font-family="monospace">${char}</text>`;
    }
  }

  svg += '</svg>';
  return svg;
}
