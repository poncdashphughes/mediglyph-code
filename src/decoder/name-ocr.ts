/**
 * Name-block OCR for MediglyphCode v3.0.
 *
 * Strategy: for each of the 30 name-block cells we know
 *   (a) the calibration colour behind the letter,
 *   (b) therefore whether the letter was drawn in black or white
 *       (chosen by the encoder via luminance),
 *   (c) the font/size/position used (fixed by the renderer).
 *
 * We generate binary templates for every character in the alphabet at the
 * exact cell dimensions in the decoded image, threshold each cell to a
 * binary letter-pixel mask, and pick the template with the highest
 * Jaccard (IoU) similarity. A mostly-empty mask is classified as space.
 */

import { PALETTE, getLuminance } from '../core/palette';
import {
  NAME_BLOCK_CALIBRATION,
  NAME_BLOCK_COLS,
  NAME_BLOCK_ROWS,
} from '../core/glyph-layout';

export const ALPHABET = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  '-',
];

type Mask = Uint8Array;

interface TemplateSet {
  w: number;
  h: number;
  masks: Map<string, Mask>;
  pixelCounts: Map<string, number>;
}

const templateCache = new Map<string, TemplateSet>();

function templateKey(w: number, h: number): string {
  return `${w}x${h}`;
}

function makeMaskFromCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  threshold: (lum: number) => boolean,
): { mask: Mask; count: number } {
  const data = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const mask = new Uint8Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    if (threshold(lum)) {
      mask[i] = 1;
      count++;
    }
  }
  return { mask, count };
}

/** Render one template character onto an offscreen canvas and extract its binary mask. */
function buildTemplate(ch: string, w: number, h: number): { mask: Mask; count: number } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // White background, black letter — matches encoder font settings
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${h * 0.85}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, w / 2, h / 2 + 0.5);
  return makeMaskFromCanvas(ctx, w, h, (lum) => lum < 0.4);
}

function getTemplates(cellW: number, cellH: number): TemplateSet {
  const w = Math.max(4, Math.round(cellW));
  const h = Math.max(4, Math.round(cellH));
  const key = templateKey(w, h);
  const cached = templateCache.get(key);
  if (cached) return cached;

  const masks = new Map<string, Mask>();
  const pixelCounts = new Map<string, number>();
  for (const ch of ALPHABET) {
    const { mask, count } = buildTemplate(ch, w, h);
    masks.set(ch, mask);
    pixelCounts.set(ch, count);
  }
  const set: TemplateSet = { w, h, masks, pixelCounts };
  templateCache.set(key, set);
  return set;
}

/**
 * Extract a binary "letter pixel" mask from a cell in the source image.
 * The mask is sized to match the template dimensions (integer w × h), with
 * the cell interior inset by ~10% on each side so cell-border anti-aliasing
 * does not contaminate the sample.
 */
function extractCellMask(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  letterIsBlack: boolean,
  templateW: number,
  templateH: number,
): { mask: Mask; count: number } {
  const inset = 0.1;
  const sx = Math.max(0, Math.round(x + w * inset));
  const sy = Math.max(0, Math.round(y + h * inset));
  const sw = Math.max(1, Math.round(w * (1 - inset * 2)));
  const sh = Math.max(1, Math.round(h * (1 - inset * 2)));
  const data = ctx.getImageData(sx, sy, sw, sh).data;

  // Classify each source pixel, then map it into a template-sized mask.
  // This keeps the mask shape comparable to the template even when the
  // source cell was rendered at a slightly different scale.
  const mask = new Uint8Array(templateW * templateH);
  let count = 0;
  for (let ty = 0; ty < templateH; ty++) {
    const srcY = Math.min(sh - 1, Math.floor((ty / templateH) * sh));
    for (let tx = 0; tx < templateW; tx++) {
      const srcX = Math.min(sw - 1, Math.floor((tx / templateW) * sw));
      const i = (srcY * sw + srcX) * 4;
      const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      const isLetter = letterIsBlack ? lum < 0.5 : lum > 0.65;
      if (isLetter) {
        mask[ty * templateW + tx] = 1;
        count++;
      }
    }
  }
  return { mask, count };
}

/** Jaccard similarity between two equal-sized binary masks. */
function jaccard(a: Mask, b: Mask, aCount: number, bCount: number): number {
  const n = Math.min(a.length, b.length);
  let inter = 0;
  for (let i = 0; i < n; i++) {
    if (a[i] && b[i]) inter++;
  }
  const union = aCount + bCount - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * OCR the 30-cell name block and return the decoded string.
 * Empty cells map to spaces; trailing spaces are trimmed, interior spaces preserved.
 */
export function ocrNameBlock(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  cellW: number,
  cellH: number,
): { name: string; confidence: number; perCell: Array<{ ch: string; score: number }> } {
  const templates = getTemplates(cellW, cellH);
  const cellAreaPx = templates.w * templates.h;
  // A real letter at 17px on a 30×20 cell fills ~15–30% of the area. Anything
  // under 8% is almost certainly noise from edge anti-aliasing — treat as space.
  const spaceCutoff = Math.max(6, cellAreaPx * 0.08);
  // If the best template match is still this weak, fall back to space rather
  // than guess a letter from near-random pixels.
  const minMatchScore = 0.2;

  const perCell: Array<{ ch: string; score: number }> = [];
  const chars: string[] = [];

  for (let row = 0; row < NAME_BLOCK_ROWS; row++) {
    for (let col = 0; col < NAME_BLOCK_COLS; col++) {
      const idx = row * NAME_BLOCK_COLS + col;
      const calibIdx = NAME_BLOCK_CALIBRATION[idx];
      const calibRgb = PALETTE[calibIdx].rgb;
      const letterIsBlack = getLuminance(calibRgb) > 0.5;

      const cellX = startX + col * cellW;
      const cellY = startY + row * cellH;
      const { mask, count } = extractCellMask(
        ctx, cellX, cellY, cellW, cellH, letterIsBlack, templates.w, templates.h,
      );

      // Empty-ish cell → space
      if (count < spaceCutoff) {
        chars.push(' ');
        perCell.push({ ch: ' ', score: 1 });
        continue;
      }

      // Compare to each template
      let bestCh = '?';
      let bestScore = -1;
      for (const ch of ALPHABET) {
        const tMask = templates.masks.get(ch)!;
        const tCount = templates.pixelCounts.get(ch)!;
        const score = jaccard(mask, tMask, count, tCount);
        if (score > bestScore) {
          bestScore = score;
          bestCh = ch;
        }
      }

      // Weak match → space
      if (bestScore < minMatchScore) {
        chars.push(' ');
        perCell.push({ ch: ' ', score: bestScore });
        continue;
      }

      chars.push(bestCh);
      perCell.push({ ch: bestCh, score: bestScore });
    }
  }

  // Preserve interior spaces, collapse runs, trim
  const raw = chars.join('');
  const name = raw.replace(/\s+/g, ' ').trim();

  const scored = perCell.filter((c) => c.ch !== ' ');
  const confidence = scored.length === 0
    ? 1
    : scored.reduce((s, c) => s + c.score, 0) / scored.length;

  return { name, confidence, perCell };
}
