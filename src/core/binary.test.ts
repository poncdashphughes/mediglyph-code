import { describe, it, expect } from 'vitest';
import {
  crc16,
  encodePatientData,
  dataToColorCells,
  decodeColorData,
  VERSION_V3,
  VERSION_V31,
} from './binary';
import { BLOOD_TYPES } from './palette';
import type { PatientData } from './types';

const PATIENT: PatientData = {
  name: 'TEST PATIENT',
  dob: '1985-06-15',
  blood: 2,
  tier0: ['00', '05'],   // Pacemaker, Warfarin/DOACs
  tier1: ['10', '20'],
  tier2: ['40'],
  tier3: ['70'],         // Non-Verbal
  phone: '+447700900123',
};

function encodeToNibbles(patient: PatientData): number[] {
  return dataToColorCells(encodePatientData(patient));
}

describe('crc16', () => {
  it('matches the CCITT-FALSE check value', () => {
    const data = Array.from('123456789').map(c => c.charCodeAt(0));
    expect(crc16(data)).toBe(0x29B1);
  });
});

describe('v3.1 round trip', () => {
  it('encodes and decodes patient data cleanly', () => {
    const decoded = decodeColorData(encodeToNibbles(PATIENT));
    expect(decoded.error).toBeUndefined();
    expect(decoded.version).toBe(VERSION_V31);
    expect(decoded.dob).toBe('1985-06-15');
    expect(decoded.blood).toBe(BLOOD_TYPES[2]);
    expect(decoded.phone).toBe('+447700900123');
    expect(decoded.tier0).toContain('Pacemaker');
    expect(decoded.tier0).toHaveLength(2);
    expect(decoded.tier1).toHaveLength(2);
    expect(decoded.tier2).toHaveLength(1);
    expect(decoded.tier3).toContain('Non-Verbal');
    expect(decoded.correctedBytes).toBe(0);
  });

  it('parity bytes are non-zero (reserved bytes now carry RS)', () => {
    const data = encodePatientData(PATIENT);
    const paritySum = data.slice(33, 38).reduce((a, b) => a + b, 0);
    expect(paritySum).toBeGreaterThan(0);
  });
});

describe('v3.1 error correction', () => {
  it('repairs one misread cell (single nibble corruption)', () => {
    const nibbles = encodeToNibbles(PATIENT);
    nibbles[10] = (nibbles[10] + 7) % 16; // byte 5 (blood type)
    const decoded = decodeColorData(nibbles);
    expect(decoded.error).toBeUndefined();
    expect(decoded.correctedBytes).toBe(1);
    expect(decoded.blood).toBe(BLOOD_TYPES[2]);
  });

  it('repairs two misread bytes', () => {
    const nibbles = encodeToNibbles(PATIENT);
    nibbles[4] = (nibbles[4] + 3) % 16;   // byte 2 (DOB year)
    nibbles[30] = (nibbles[30] + 9) % 16; // byte 15 (conditions)
    const decoded = decodeColorData(nibbles);
    expect(decoded.error).toBeUndefined();
    expect(decoded.correctedBytes).toBe(2);
    expect(decoded.dob).toBe('1985-06-15');
    expect(decoded.tier0).toHaveLength(2);
  });

  it('recovers damaged CRC cells with a warning (CRC sits outside RS coverage)', () => {
    const nibbles = encodeToNibbles(PATIENT);
    nibbles[77] = (nibbles[77] + 5) % 16; // byte 38 — stored CRC high byte
    const decoded = decodeColorData(nibbles);
    expect(decoded.error).toBeUndefined();
    expect(decoded.warning).toMatch(/error correction/i);
    expect(decoded.dob).toBe('1985-06-15');
    expect(decoded.phone).toBe('+447700900123');
  });

  it('repairs up to four flagged bytes using erasure hints', () => {
    const nibbles = encodeToNibbles(PATIENT);
    const corruptBytes = [2, 9, 15, 25];
    for (const b of corruptBytes) {
      nibbles[b * 2] = (nibbles[b * 2] + 4) % 16;
    }
    // Without hints: 4 errors > 2-error capacity
    const blind = decodeColorData(nibbles);
    expect(blind.error).toBeDefined();
    // With hints: 4 erasures <= 5-erasure capacity
    const hinted = decodeColorData(nibbles, new Set(corruptBytes));
    expect(hinted.error).toBeUndefined();
    expect(hinted.correctedBytes).toBe(4);
    expect(hinted.dob).toBe('1985-06-15');
  });

  it('reports an error honestly when damage exceeds capacity', () => {
    const nibbles = encodeToNibbles(PATIENT);
    for (const b of [1, 5, 10, 16, 22, 28]) {
      nibbles[b * 2] = (nibbles[b * 2] + 8) % 16;
    }
    const decoded = decodeColorData(nibbles);
    expect(decoded.error).toBeDefined();
  });
});

describe('v3.0 compatibility', () => {
  function makeV30Nibbles(patient: PatientData): number[] {
    const data = encodePatientData(patient);
    data[0] = VERSION_V3;
    for (let i = 33; i < 38; i++) data[i] = 0; // v3.0 reserved bytes
    const crc = crc16(data.slice(0, 38));
    data[38] = (crc >> 8) & 0xFF;
    data[39] = crc & 0xFF;
    return dataToColorCells(data);
  }

  it('decodes a clean v3.0 glyph (zero reserved bytes)', () => {
    const decoded = decodeColorData(makeV30Nibbles(PATIENT));
    expect(decoded.error).toBeUndefined();
    expect(decoded.version).toBe(VERSION_V3);
    expect(decoded.dob).toBe('1985-06-15');
    expect(decoded.correctedBytes).toBe(0);
  });

  it('flags corruption on a v3.0 glyph without inventing a repair', () => {
    const nibbles = makeV30Nibbles(PATIENT);
    nibbles[10] = (nibbles[10] + 7) % 16;
    const decoded = decodeColorData(nibbles);
    expect(decoded.error).toBeDefined();
    expect(decoded.warning).toBeUndefined();
  });
});
