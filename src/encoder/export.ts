import type { PatientData } from '../core/types';
import { renderGlyphSVG } from './glyph-renderer';

/** Download canvas as PNG */
export function downloadPNG(canvas: HTMLCanvasElement, filename: string = 'mediglyph.png') {
  // Render at higher resolution for print quality
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/** Download SVG file */
export function downloadSVG(patient: PatientData, filename: string = 'mediglyph.svg') {
  const svg = renderGlyphSVG(patient);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Copy encoded hex data to clipboard */
export async function copyHexData(encodedData: number[]): Promise<void> {
  const hex = encodedData.map(b => b.toString(16).padStart(2, '0')).join(' ');
  await navigator.clipboard.writeText(hex);
}
