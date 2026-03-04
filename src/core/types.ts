export interface PatientData {
  name: string;
  dob: string; // ISO format YYYY-MM-DD
  blood: number; // 0-8 index into BLOOD_TYPES
  tier0: string[]; // hex code strings e.g. ['00', '03']
  tier1: string[];
  tier2: string[];
  tier3: string[];
  phone: string; // e.g. '+447700900123'
}

export interface DecodedResult {
  version: number;
  flags: number;
  name: string;
  dob: string;
  blood: string;
  tier0: string[];
  tier1: string[];
  tier2: string[];
  tier3: string[];
  phone: string;
  humanZone?: HumanZoneResult;
  error?: string;
  debug?: Record<string, unknown>;
}

export interface HumanZoneResult {
  tier0: boolean;
  tier1: boolean;
  tier2: boolean;
  tier3: boolean;
  tier4: boolean;
}

export interface PaletteEntry {
  name: string;
  hex: string;
  rgb: [number, number, number];
}

export interface ConditionCode {
  code: string; // hex string e.g. '00', '10'
  tier: 0 | 1 | 2 | 3 | 4;
  subcategory: string;
  label: string;
  shortLabel: string;
}

export interface ColourMatch {
  index: number;
  distance: number;
  confidence: number;
  color: string;
}

export interface GlyphLayout {
  pxPerMm: number;
  totalWidth: number;
  totalHeight: number;
  quietZone: number;
  t0Size: number;
  tSmallSize: number;
  humanZoneWidth: number;
  humanZoneHeight: number;
  dataGridCols: number;
  dataGridRows: number;
  dataCellSize: number;
  dataZoneX: number;
  dataZoneY: number;
}
