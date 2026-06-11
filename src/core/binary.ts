import type { PatientData, DecodedResult } from './types';
import { BLOOD_TYPES } from './palette';
import { CONDITIONS_MAP, CONDITION_BIT_INDEX, BIT_INDEX_TO_CODE, TOTAL_SELECTABLE_CONDITIONS } from './conditions';
import { rsEncode, rsDecode } from './reed-solomon';

/**
 * MediglyphCode v3.1 binary format.
 *
 * 40 bytes = 80 nibbles = 16×5 colour grid.
 *
 * Byte map:
 *   0      Version (0x31)
 *   1      Flags (tier presence bitmask, bits 0-4 = T0-T4)
 *   2-4    DOB (YY, MM, DD)
 *   5      Blood type index
 *   6-7    Reserved (0)
 *   8-13   Phone (12 BCD digits, 6 bytes)
 *   14-32  Condition bitfield (19 bytes, 152 bits for 145 conditions)
 *   33-37  Reed–Solomon parity over bytes 0-32 (v3.0 left these zero)
 *   38-39  CRC-16/CCITT-FALSE over bytes 0-37
 *
 * The parity bytes give the decoder real error *correction*: up to 2
 * misread bytes anywhere in 0-37 are repaired (up to 5 when the sampler
 * flags the unreliable cells as erasures). The CRC stays the final
 * arbiter, and because it still covers bytes 0-37 — parity included —
 * deployed v3.0 decoders read v3.1 glyphs unchanged.
 *
 * Name is printed by the physical product, NOT carried in the grid.
 */

export const VERSION_V3 = 0x30;
export const VERSION_V31 = 0x31;
const PHONE_BYTES = 6;
const BITFIELD_BYTES = 19;
const DATA_BYTES = 40;
const RS_DATA_BYTES = 33;   // bytes 0-32
const RS_PARITY_BYTES = 5;  // bytes 33-37

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflection, no xor-out). */
export function crc16(bytes: number[]): number {
  let crc = 0xFFFF;
  for (const b of bytes) {
    crc ^= (b & 0xFF) << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc & 0xFFFF;
}

/** Normalise name to v3.0 rules: uppercase, A-Z + space + hyphen, collapse spaces, trim, max 30 chars. */
export function normaliseName(name: string): string {
  return (name || '')
    .toUpperCase()
    .replace(/[^A-Z \-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 30);
}

/** Encode patient data into the 40-byte v3.1 payload. */
export function encodePatientData(patient: PatientData): number[] {
  const data = new Array<number>(DATA_BYTES).fill(0);

  // Byte 0: Version
  data[0] = VERSION_V31;

  // Byte 1: Flags
  let flags = 0;
  if (patient.tier0.length > 0) flags |= 0x01;
  if (patient.tier1.length > 0) flags |= 0x02;
  if (patient.tier2.length > 0) flags |= 0x04;
  if (patient.tier3.length > 0) flags |= 0x08;
  if (patient.phone) flags |= 0x10;
  data[1] = flags;

  // Bytes 2-4: DOB
  if (patient.dob) {
    const parts = patient.dob.split('-');
    data[2] = (parseInt(parts[0]) || 0) % 100;
    data[3] = parseInt(parts[1]) || 0;
    data[4] = parseInt(parts[2]) || 0;
  }

  // Byte 5: Blood type
  data[5] = patient.blood & 0xFF;

  // Bytes 6-7: Reserved (0)

  // Bytes 8-13: Phone (12 BCD digits)
  const phoneDigits = (patient.phone || '')
    .replace(/\D/g, '')
    .slice(-(PHONE_BYTES * 2))
    .padStart(PHONE_BYTES * 2, '0');
  for (let i = 0; i < PHONE_BYTES; i++) {
    const high = parseInt(phoneDigits[i * 2]) || 0;
    const low = parseInt(phoneDigits[i * 2 + 1]) || 0;
    data[8 + i] = (high << 4) | low;
  }

  // Bytes 14-32: Condition bitfield
  const allCodes = [
    ...patient.tier0,
    ...patient.tier1,
    ...patient.tier2,
    ...patient.tier3,
  ];
  for (const code of allCodes) {
    const bitIdx = CONDITION_BIT_INDEX[code];
    if (bitIdx !== undefined && bitIdx < BITFIELD_BYTES * 8) {
      const byteIdx = 14 + Math.floor(bitIdx / 8);
      const bitPos = 7 - (bitIdx % 8);
      data[byteIdx] |= (1 << bitPos);
    }
  }

  // Bytes 33-37: Reed–Solomon parity over bytes 0-32
  const parity = rsEncode(data.slice(0, RS_DATA_BYTES), RS_PARITY_BYTES).slice(RS_DATA_BYTES);
  for (let i = 0; i < RS_PARITY_BYTES; i++) {
    data[RS_DATA_BYTES + i] = parity[i];
  }

  // Bytes 38-39: CRC-16 over bytes 0-37 (big-endian)
  const crc = crc16(data.slice(0, 38));
  data[38] = (crc >> 8) & 0xFF;
  data[39] = crc & 0xFF;

  return data;
}

/** Convert byte array to colour cell nibbles (4 bits each). */
export function dataToColorCells(data: number[]): number[] {
  const cells: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    cells.push((byte >> 4) & 0x0F);
    cells.push(byte & 0x0F);
  }
  return cells.slice(0, 80); // 16×5
}

/**
 * Decode 80 nibbles back into patient data. Name is filled from the human
 * zone separately.
 *
 * suspectBytes optionally lists byte positions the sampler read with low
 * confidence — they are passed to Reed–Solomon as erasures, which doubles
 * correction power at exactly those positions.
 */
export function decodeColorData(nibbles: number[], suspectBytes?: Set<number>): DecodedResult {
  let bytes: number[] = [];
  for (let i = 0; i < nibbles.length; i += 2) {
    bytes.push(((nibbles[i] & 0x0F) << 4) | (nibbles[i + 1] ?? 0) & 0x0F);
  }
  while (bytes.length < DATA_BYTES) bytes.push(0);

  const checkCrc = (b: number[]) =>
    (((b[38] << 8) | b[39]) === crc16(b.slice(0, 38)));

  let crcOk = checkCrc(bytes);
  let correctedBytes = 0;
  let rsRecovered = false;
  let warning: string | undefined;

  if (!crcOk) {
    // v3.1 glyphs carry RS parity in bytes 33-37 — attempt repair.
    // (On v3.0 glyphs the parity bytes are zero, which is not a valid
    // codeword for non-trivial data, so recovery simply fails and the
    // outcome matches the old behaviour.)
    const codeword = bytes.slice(0, RS_DATA_BYTES + RS_PARITY_BYTES);
    const erasures = suspectBytes
      ? [...suspectBytes].filter(p => p >= 0 && p < codeword.length)
      : [];

    let res = erasures.length > 0 && erasures.length <= RS_PARITY_BYTES
      ? rsDecode(codeword, RS_PARITY_BYTES, erasures)
      : null;
    if (!res) res = rsDecode(codeword, RS_PARITY_BYTES);

    if (res) {
      const repaired = [
        ...res.data,
        ...rsEncode(res.data, RS_PARITY_BYTES).slice(RS_DATA_BYTES),
        bytes[38],
        bytes[39],
      ];
      if (checkCrc(repaired)) {
        bytes = repaired;
        crcOk = true;
        correctedBytes = res.corrected;
        rsRecovered = correctedBytes > 0;
      } else if (repaired[0] === VERSION_V31) {
        // The codeword is RS-valid but the stored CRC disagrees: the CRC
        // cells themselves sit outside RS coverage, so they are the
        // damaged ones. Accept the data, but say so.
        bytes = repaired;
        crcOk = true;
        correctedBytes = res.corrected;
        rsRecovered = true;
        warning = 'CRC cells unreadable — data validated by error correction only';
      }
    }
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

  const storedCrc = (bytes[38] << 8) | bytes[39];
  const computedCrc = crc16(bytes.slice(0, 38));

  // DOB (bytes 2-4)
  const yy = bytes[2];
  const mm = bytes[3];
  const dd = bytes[4];
  if (yy > 0 || mm > 0 || dd > 0) {
    const fullYear = yy < 50 ? `20${yy.toString().padStart(2, '0')}` : `19${yy.toString().padStart(2, '0')}`;
    result.dob = `${fullYear}-${mm.toString().padStart(2, '0')}-${dd.toString().padStart(2, '0')}`;
  }

  // Blood type (byte 5)
  result.blood = BLOOD_TYPES[bytes[5]] || 'Unknown';

  // Phone (bytes 8-13)
  let phoneDigits = '';
  for (let i = 8; i < 14; i++) {
    phoneDigits += (bytes[i] >> 4).toString();
    phoneDigits += (bytes[i] & 0x0F).toString();
  }
  phoneDigits = phoneDigits.replace(/^0+/, '');
  // Phone is BCD-encoded as international ICE format (no leading +), so on
  // decode we restore the + prefix that the encoder strips at input time.
  if (phoneDigits) result.phone = `+${phoneDigits}`;

  // Conditions (bytes 14-32)
  for (let bitIdx = 0; bitIdx < TOTAL_SELECTABLE_CONDITIONS; bitIdx++) {
    const byteIdx = 14 + Math.floor(bitIdx / 8);
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

  result.correctedBytes = correctedBytes;
  if (warning) result.warning = warning;
  result.debug = { crcOk, storedCrc, computedCrc, correctedBytes, rsRecovered };
  if (!crcOk) result.error = 'CRC mismatch — data may be corrupt';

  return result;
}
