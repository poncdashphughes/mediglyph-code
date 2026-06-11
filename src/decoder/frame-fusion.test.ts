import { describe, it, expect } from 'vitest';
import { FrameFusion } from './frame-fusion';
import { encodePatientData, dataToColorCells, decodeColorData } from '../core/binary';
import type { PatientData } from '../core/types';

const PATIENT: PatientData = {
  name: 'TEST PATIENT',
  dob: '1985-06-15',
  blood: 2,
  tier0: ['00', '05'],
  tier1: ['10', '20'],
  tier2: ['40'],
  tier3: ['70'],
  phone: '+447700900123',
};

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function truthNibbles(): number[] {
  return dataToColorCells(encodePatientData(PATIENT));
}

/** A frame with nErrors random cells confidently wrong */
function noisyFrame(truth: number[], nErrors: number, rand: () => number) {
  const nibbles = [...truth];
  const confidences = new Array(80).fill(0.8);
  const hit = new Set<number>();
  while (hit.size < nErrors) hit.add(Math.floor(rand() * 80));
  for (const c of hit) {
    nibbles[c] = (nibbles[c] + 1 + Math.floor(rand() * 14)) % 16;
    confidences[c] = 1.0; // confidently wrong — the hard case
  }
  return { nibbles, confidences };
}

describe('FrameFusion', () => {
  it('returns no consensus until two frames arrive', () => {
    const fusion = new FrameFusion();
    expect(fusion.consensus()).toBeNull();
    fusion.addFrame(truthNibbles(), new Array(80).fill(1));
    expect(fusion.consensus()).toBeNull();
  });

  it('ignores frames without a full grid', () => {
    const fusion = new FrameFusion();
    fusion.addFrame([1, 2, 3], [1, 1, 1]);
    expect(fusion.frameCount).toBe(0);
  });

  it('recovers the true grid from frames that each fail alone', () => {
    const truth = truthNibbles();
    const rand = lcg(42);

    // 6 wrong cells per frame is beyond single-frame blind RS capacity,
    // but the wrong cells differ per frame
    for (let trial = 0; trial < 10; trial++) {
      const fusion = new FrameFusion();
      for (let f = 0; f < 5; f++) {
        const frame = noisyFrame(truth, 6, rand);
        // Confirm the frame really does fail on its own
        expect(decodeColorData(frame.nibbles).error).toBeDefined();
        fusion.addFrame(frame.nibbles, frame.confidences);
      }

      const cons = fusion.consensus();
      expect(cons).not.toBeNull();
      const decoded = decodeColorData(cons!.nibbles, cons!.suspectBytes);
      expect(decoded.error, `trial ${trial}`).toBeUndefined();
      expect(decoded.dob).toBe('1985-06-15');
      expect(decoded.phone).toBe('+447700900123');
    }
  });

  it('marks contested cells as suspect bytes', () => {
    const truth = truthNibbles();
    const fusion = new FrameFusion();

    const flipped = [...truth];
    flipped[10] = (flipped[10] + 5) % 16; // cell 10 → byte 5 contested
    fusion.addFrame(truth, new Array(80).fill(0.8));
    fusion.addFrame(flipped, new Array(80).fill(0.8));

    const cons = fusion.consensus()!;
    expect(cons.suspectBytes.has(5)).toBe(true);
    expect(cons.suspectBytes.has(20)).toBe(false);
  });

  it('keeps only the most recent frames', () => {
    const truth = truthNibbles();
    const fusion = new FrameFusion();
    for (let i = 0; i < 12; i++) {
      fusion.addFrame(truth, new Array(80).fill(1));
    }
    expect(fusion.frameCount).toBe(8);
  });

  it('reset clears the window', () => {
    const fusion = new FrameFusion();
    fusion.addFrame(truthNibbles(), new Array(80).fill(1));
    fusion.reset();
    expect(fusion.frameCount).toBe(0);
  });
});
