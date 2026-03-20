import type { PatientData, DecodedResult } from './types';
import { BLOOD_TYPES } from './palette';
import { CONDITIONS_MAP, CONDITION_BIT_INDEX, BIT_INDEX_TO_CODE, TOTAL_SELECTABLE_CONDITIONS } from './conditions';

/**
 * Encode a character (A-Z, 0-9, space) as a 6-bit value.
 * 0=space, 1-26=A-Z, 27-36=0-9
 */
function charTo6bit(ch: number): number {
  if (ch >= 65 && ch <= 90) return ch - 64;
  if (ch >= 48 && ch <= 57) return ch - 48 + 27;
  return 0; // space
}

/** Pack 12 characters into 9 bytes using 6-bit encoding (72 bits). */
function packName(name: string): number[] {
  const padded = name.toUpperCase().substring(0, 12).padEnd(12, ' ');
  const vals = Array.from(padded).map(c => charTo6bit(c.charCodeAt(0)));

  const bytes: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const v of vals) {
    buf = (buf << 6) | (v & 0x3F);
    bits += 6;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xFF);
    }
  }
  return bytes; // exactly 9 bytes
}

/** Unpack 9 bytes into 12 characters using 6-bit encoding. */
function unpackName(bytes: number[]): string {
  let buf = 0;
  let bits = 0;
  let byteIdx = 0;
  const chars: string[] = [];

  for (let i = 0; i < 12; i++) {
    while (bits < 6) {
      buf = (buf << 8) | (bytes[byteIdx++] || 0);
      bits += 8;
    }
    bits -= 6;
    const val = (buf >> bits) & 0x3F;
    if (val === 0) chars.push(' ');
    else if (val >= 1 && val <= 26) chars.push(String.fromCharCode(64 + val));
    else if (val >= 27 && val <= 36) chars.push(String.fromCharCode(48 + val - 27));
    else chars.push('?');
  }
  return chars.join('').trim();
}

/** Number of bytes needed for condition bitfield */
const BITFIELD_BYTES = 19; // 152 bits, covers all 145 selectable conditions

/** Number of BCD bytes for phone (12 digits) */
const PHONE_BYTES = 6;

/**
 * Encode patient data into a byte array.
 *
 * Format v2.0 (40 bytes = 80 nibbles = 16×5 grid):
 *   Byte 0:       Version (0x20 for v2.0)
 *   Byte 1:       Flags (tier presence bitmask)
 *   Bytes 2-10:   Name (12 chars, 6-bit packed into 9 bytes)
 *   Bytes 11-13:  DOB (YY, MM, DD)
 *   Byte 14:      Blood type index (0-8)
 *   Bytes 15-33:  Condition bitfield (19 bytes = 152 bits)
 *   Bytes 34-39:  Phone (12 digits as BCD, 6 bytes)
 */
export function encodePatientData(patient: PatientData): number[] {
  const data: number[] = [];

  // Byte 0: Version
  data.push(0x20);

  // Byte 1: Flags
  let flags = 0;
  if (patient.tier0.length > 0) flags |= 0x01;
  if (patient.tier1.length > 0) flags |= 0x02;
  if (patient.tier2.length > 0) flags |= 0x04;
  if (patient.tier3.length > 0) flags |= 0x08;
  if (patient.phone) flags |= 0x10;
  data.push(flags);

  // Bytes 2-10: Name (12 chars, 6-bit packed)
  data.push(...packName(patient.name));

  // Bytes 11-13: DOB
  if (patient.dob) {
    const parts = patient.dob.split('-');
    data.push(parseInt(parts[0]) % 100);
    data.push(parseInt(parts[1]));
    data.push(parseInt(parts[2]));
  } else {
    data.push(0, 0, 0);
  }

  // Byte 14: Blood type
  data.push(patient.blood);

  // Bytes 15-33: Condition bitfield (19 bytes)
  const bitfield = new Uint8Array(BITFIELD_BYTES);
  const allCodes = [
    ...patient.tier0,
    ...patient.tier1,
    ...patient.tier2,
    ...patient.tier3,
  ];
  for (const code of allCodes) {
    const bitIdx = CONDITION_BIT_INDEX[code];
    if (bitIdx !== undefined) {
      const byteIdx = Math.floor(bitIdx / 8);
      const bitPos = 7 - (bitIdx % 8);
      bitfield[byteIdx] |= (1 << bitPos);
    }
  }
  data.push(...bitfield);

  // Bytes 34-39: Phone (up to 12 digits as BCD)
  const phoneDigits = patient.phone.replace(/\D/g, '').slice(-(PHONE_BYTES * 2)).padStart(PHONE_BYTES * 2, '0');
  for (let i = 0; i < PHONE_BYTES; i++) {
    const high = parseInt(phoneDigits[i * 2]) || 0;
    const low = parseInt(phoneDigits[i * 2 + 1]) || 0;
    data.push((high << 4) | low);
  }

  // Total: 40 bytes = 80 nibbles = 16×5 grid
  return data;
}

/** Convert byte array to colour cell nibbles (4 bits each) */
export function dataToColorCells(data: number[]): number[] {
  const cells: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    cells.push((byte >> 4) & 0x0F);
    cells.push(byte & 0x0F);
  }
  return cells.slice(0, 80); // 16×5
}

/** Decode nibbles back into patient data */
export function decodeColorData(nibbles: number[]): DecodedResult {
  // Convert nibbles to bytes
  const bytes: number[] = [];
  for (let i = 0; i < nibbles.length; i += 2) {
    bytes.push((nibbles[i] << 4) | (nibbles[i + 1] ?? 0));
  }

  const result: DecodedResult = {
    version: bytes[0],
    flags: bytes[1],
    name: '',
    dob: '',
    blood: 'Unknown',
    tier0: [],
    tier1: [],
    tier2: [],
    tier3: [],
    phone: '',
  };

  // Name (bytes 2-10, 6-bit packed, 12 chars)
  result.name = unpackName(bytes.slice(2, 11));

  // DOB (bytes 11-13)
  const year = bytes[11];
  const month = bytes[12];
  const day = bytes[13];
  if (year > 0 || month > 0 || day > 0) {
    const fullYear = year < 50 ? `20${year.toString().padStart(2, '0')}` : `19${year.toString().padStart(2, '0')}`;
    result.dob = `${fullYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  // Blood type (byte 14)
  result.blood = BLOOD_TYPES[bytes[14]] || 'Unknown';

  // Conditions (bytes 15-33, bitfield)
  for (let bitIdx = 0; bitIdx < TOTAL_SELECTABLE_CONDITIONS; bitIdx++) {
    const byteIdx = 15 + Math.floor(bitIdx / 8);
    const bitPos = 7 - (bitIdx % 8);
    if (byteIdx < bytes.length && (bytes[byteIdx] >> bitPos) & 1) {
      const code = BIT_INDEX_TO_CODE[bitIdx];
      if (code) {
        const label = CONDITIONS_MAP[code] || code;
        const codeNum = parseInt(code, 16);
        if (codeNum < 0x10) result.tier0.push(label);
        else if (codeNum < 0x38) result.tier1.push(label);
        else if (codeNum < 0x70) result.tier2.push(label);
        else if (codeNum < 0x8e) result.tier3.push(label);
      }
    }
  }

  // Phone (bytes 34-39, 12 BCD digits)
  let phoneDigits = '';
  for (let i = 34; i < 40 && i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== 0xEE) {
      phoneDigits += (byte >> 4).toString();
      phoneDigits += (byte & 0x0F).toString();
    }
  }
  // Strip leading zeros but keep at least the meaningful digits
  phoneDigits = phoneDigits.replace(/^0+/, '');
  if (phoneDigits) {
    result.phone = phoneDigits;
  }

  return result;
}
