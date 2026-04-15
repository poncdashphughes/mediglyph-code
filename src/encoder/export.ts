import type { PatientData } from '../core/types';
import { renderGlyphSVG } from './glyph-renderer';

/**
 * Compose the rendered glyph with the patient name printed above it.
 *
 * v3.0 carries no name inside the glyph — it is printed externally as
 * normal typography by the physical product. We embed the same
 * convention into the exported file so:
 *   1. Users with multiple saved glyphs can tell them apart at a glance.
 *   2. The decoder's external-name OCR has something to read when the
 *      file itself is re-uploaded.
 * Users are free to crop the text out if they prefer to typeset the
 * name themselves on their physical product.
 */
function composeWithName(
  glyph: HTMLCanvasElement,
  name: string,
): HTMLCanvasElement {
  const padX = 12;
  const padTop = 8;
  const padBottom = 8;
  const fontPx = Math.max(18, Math.round(glyph.height * 0.18));
  const labelHeight = name ? fontPx + padTop + padBottom : 0;

  const out = document.createElement('canvas');
  out.width = glyph.width + padX * 2;
  out.height = glyph.height + labelHeight + padBottom;

  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, out.width, out.height);

  if (name) {
    ctx.fillStyle = '#111111';
    ctx.font = `600 ${fontPx}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(name, out.width / 2, padTop);
  }

  ctx.drawImage(glyph, padX, labelHeight);
  return out;
}

/** Download canvas as PNG, with the patient name printed above the glyph. */
export function downloadPNG(
  canvas: HTMLCanvasElement,
  filename: string = 'mediglyph.png',
  name: string = '',
) {
  const composed = composeWithName(canvas, name.trim());
  const link = document.createElement('a');
  link.download = filename;
  link.href = composed.toDataURL('image/png');
  link.click();
}

/** Download SVG file, with the patient name printed above the glyph. */
export function downloadSVG(
  patient: PatientData,
  filename: string = 'mediglyph.svg',
) {
  const inner = renderGlyphSVG(patient);
  const svg = wrapSVGWithName(inner, (patient.name || '').trim());
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Re-wrap the bare glyph SVG inside a larger SVG that prints the name above it. */
function wrapSVGWithName(inner: string, name: string): string {
  const dimMatch = inner.match(/width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/);
  if (!dimMatch) return inner;
  const w = parseFloat(dimMatch[1]);
  const h = parseFloat(dimMatch[2]);

  const padX = 12;
  const padTop = 8;
  const padBottom = 8;
  const fontPx = Math.max(18, Math.round(h * 0.18));
  const labelHeight = name ? fontPx + padTop + padBottom : 0;

  const outW = w + padX * 2;
  const outH = h + labelHeight + padBottom;

  // Re-emit inner SVG as a <g> so we can position it.
  const innerBody = inner
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');

  const label = name
    ? `<text x="${outW / 2}" y="${padTop + fontPx * 0.82}" text-anchor="middle" font-size="${fontPx}" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="#111">${escapeXml(name)}</text>`
    : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}">`,
    `<rect width="${outW}" height="${outH}" fill="#FFFFFF"/>`,
    label,
    `<g transform="translate(${padX}, ${labelHeight})">${innerBody}</g>`,
    '</svg>',
  ].join('');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Copy encoded hex data to clipboard */
export async function copyHexData(encodedData: number[]): Promise<void> {
  const hex = encodedData.map(b => b.toString(16).padStart(2, '0')).join(' ');
  await navigator.clipboard.writeText(hex);
}
