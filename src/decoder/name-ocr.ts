/**
 * External-name OCR for MediglyphCode v3.0.
 *
 * The patient name lives outside the glyph as printed typography on the
 * physical product (bracelet, card, sticker). When decoding a photograph
 * that includes the surrounding context, we crop the region directly above
 * the glyph and run Tesseract on it.
 *
 * Tesseract.js is lazy-loaded on first use: the worker, the WASM core, and
 * the English language data are fetched from the bundled package on demand
 * and then cached by the browser. Subsequent decodes reuse the same worker.
 */

import type { Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      // Names are alphabetic; restrict the recogniser so it does not
      // hallucinate digits from print speckle.
      await worker.setParameters({
        tessedit_char_whitelist:
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz \'-',
      });
      return worker;
    })();
  }
  return workerPromise;
}

/** Crop the region directly above the glyph bounds — this is where the
 *  product is conventionally expected to print the patient name. */
function cropNameRegion(
  source: HTMLCanvasElement,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): HTMLCanvasElement | null {
  const padX = Math.round((bounds.maxX - bounds.minX) * 0.05);
  const cropX = Math.max(0, bounds.minX - padX);
  const cropW = Math.min(source.width - cropX, bounds.maxX - bounds.minX + padX * 2);
  const cropY = 0;
  const cropH = Math.max(0, bounds.minY);

  if (cropH < 12 || cropW < 40) return null; // not enough room for text

  const canvas = document.createElement('canvas');
  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return canvas;
}

export interface ExternalNameResult {
  name: string;
  confidence: number;
  attempted: boolean;
}

/**
 * Read the printed name from the photograph. Returns `attempted: false` when
 * there is no usable region above the glyph (e.g. the user uploaded a tightly
 * cropped glyph-only image).
 */
export async function readExternalName(
  source: HTMLCanvasElement,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): Promise<ExternalNameResult> {
  const region = cropNameRegion(source, bounds);
  if (!region) return { name: '', confidence: 0, attempted: false };

  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(region);
    const cleaned = (data.text || '')
      .replace(/[^A-Za-z \-']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Tesseract often returns two-line output for one visual line; take the
    // longest non-empty line as the most likely name.
    const lines = (data.text || '').split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
    const best = lines.length
      ? lines.reduce((a, b) => (b.length > a.length ? b : a))
      : cleaned;
    const name = best.replace(/[^A-Za-z \-']/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      name,
      confidence: (data.confidence ?? 0) / 100,
      attempted: true,
    };
  } catch (err) {
    console.warn('Name OCR failed', err);
    return { name: '', confidence: 0, attempted: true };
  }
}
