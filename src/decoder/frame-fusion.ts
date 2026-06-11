/**
 * Multi-frame fusion for continuous scanning.
 *
 * A hand-held scan produces a stream of marginal frames — each with a
 * few misread cells, but rarely the *same* cells. Fusing per-cell
 * colour votes across recent frames recovers a consensus grid that can
 * validate even when no individual frame does. Contested cells (where
 * frames disagree) are reported as suspects so Reed–Solomon can treat
 * them as erasures.
 */

const CELLS = 80; // 16 × 5 data grid
const MAX_FRAMES = 8;
/** A cell whose winning colour holds less than this share of the vote is suspect */
const SUSPECT_SHARE = 0.7;

interface FusionFrame {
  nibbles: number[];
  confidences: number[];
}

export interface FusionConsensus {
  nibbles: number[];
  suspectBytes: Set<number>;
  frames: number;
}

export class FrameFusion {
  private frames: FusionFrame[] = [];

  /** Add one frame's sampled grid. Frames missing a full grid are ignored. */
  addFrame(nibbles: number[], confidences: number[]): void {
    if (!nibbles || nibbles.length < CELLS) return;
    this.frames.push({
      nibbles: nibbles.slice(0, CELLS),
      confidences: (confidences || []).slice(0, CELLS),
    });
    if (this.frames.length > MAX_FRAMES) this.frames.shift();
  }

  get frameCount(): number {
    return this.frames.length;
  }

  reset(): void {
    this.frames = [];
  }

  /**
   * Confidence-weighted majority vote per cell across the window.
   * Returns null until at least two frames have been collected — a
   * single frame has already had its chance on its own.
   */
  consensus(): FusionConsensus | null {
    if (this.frames.length < 2) return null;

    const nibbles: number[] = [];
    const cellShare: number[] = [];

    for (let c = 0; c < CELLS; c++) {
      const weights = new Array(16).fill(0);
      let total = 0;
      for (const f of this.frames) {
        const w = Math.max(0.05, f.confidences[c] ?? 0);
        weights[f.nibbles[c] & 0x0F] += w;
        total += w;
      }
      let best = 0;
      for (let v = 1; v < 16; v++) {
        if (weights[v] > weights[best]) best = v;
      }
      nibbles.push(best);
      cellShare.push(total > 0 ? weights[best] / total : 0);
    }

    const suspectBytes = new Set<number>();
    for (let b = 0; b < CELLS / 2; b++) {
      if (Math.min(cellShare[b * 2], cellShare[b * 2 + 1]) < SUSPECT_SHARE) {
        suspectBytes.add(b);
      }
    }

    return { nibbles, suspectBytes, frames: this.frames.length };
  }
}
