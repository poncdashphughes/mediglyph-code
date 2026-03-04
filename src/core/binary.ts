import type { PatientData, DecodedResult } from './types';
import { BLOOD_TYPES } from './palette';
import { CONDITIONS_MAP } from './conditions';

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

/**
 * Encode patient data into a byte array.
 *
 * Format (24 bytes = 48 nibbles = 12×4 grid):
 *   Byte 0:      Version (0x12 for v1.2)
 *   Byte 1:      Flags (tier presence bitmask)
 *   Bytes 2-10:  Name (12 chars, 6-bit packed into 9 bytes)
 *   Bytes 11-13: DOB (YY, MM, DD)
 *   Byte 14:     Blood type index (0-8)
 *   Bytes 15-18: Condition codes (up to 4, padded with 0xFF)
 *   Bytes 19-22: Phone (last 8 digits as BCD)
 *   Byte 23:     Reserved (0x00)
 */
export function encodePatientData(patient: PatientData): number[] {
  const data: number[] = [];

  // Byte 0: Version
  data.push(0x12);

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

  // Bytes 15-18: Conditions (up to 4)
  const allConditions = [
    ...patient.tier0.map(c => parseInt(c, 16)),
    ...patient.tier1.map(c => parseInt(c, 16)),
    ...patient.tier2.map(c => parseInt(c, 16)),
    ...patient.tier3.map(c => parseInt(c, 16)),
  ].slice(0, 4);

  while (allConditions.length < 4) {
    allConditions.push(0xFF);
  }
  data.push(...allConditions);

  // Bytes 19-22: Phone (last 8 digits as BCD)
  const phoneDigits = patient.phone.replace(/\D/g, '').slice(-8).padStart(8, '0');
  for (let i = 0; i < 4; i++) {
    const high = parseInt(phoneDigits[i * 2]) || 0;
    const low = parseInt(phoneDigits[i * 2 + 1]) || 0;
    data.push((high << 4) | low);
  }

  // Byte 23: Reserved
  data.push(0x00);

  // Total: 24 bytes = 48 nibbles = 12×4 grid
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
  return cells.slice(0, 48); // 12×4
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

  // Conditions (bytes 15-18)
  for (let i = 15; i < 19; i++) {
    const code = bytes[i];
    if (code !== 0xFF && code !== 0xEE) {
      const hexCode = code.toString(16).padStart(2, '0');
      const label = CONDITIONS_MAP[hexCode] || hexCode;
      if (code < 0x10) result.tier0.push(label);
      else if (code < 0x38) result.tier1.push(label);
      else if (code < 0x70) result.tier2.push(label);
      else if (code < 0x8e) result.tier3.push(label);
    }
  }

  // Phone (bytes 19-22)
  let phoneDigits = '';
  for (let i = 19; i < 23 && i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== 0xEE) {
      phoneDigits += (byte >> 4).toString();
      phoneDigits += (byte & 0x0F).toString();
    }
  }
  if (phoneDigits && phoneDigits !== '00000000') {
    result.phone = phoneDigits;
  }

  return result;
}
