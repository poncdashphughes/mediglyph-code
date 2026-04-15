# MediglyphCode Specification v3.0

**Status:** Draft
**Supersedes:** v2.0 (breaking change)
**Physical size:** 24mm × 14mm (watch-strap, top-of-wrist)

## 1. Design principles

v3.0 separates the glyph into two strict zones:

- **Human zone** (top): eye-readable. Triage tier indicators + patient name.
- **Machine zone** (bottom): 16×5 pure colour grid. No letter overlays.

The name block doubles as an **embedded colour calibration reference**: its 30 cells are painted in a fixed pattern covering every palette colour, and the decoder samples them to build a per-photograph colour-correction LUT before reading the data grid. This absorbs lighting, white-balance, and print/substrate drift that previously ate decode reliability.

## 2. Physical layout

```
┌────────────────────────────────────────────────────────────┐
│                     1mm quiet zone                         │
│  ┌─────┐ ┌──┬──┐  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐          │
│  │     │ │T1│T2│  │P │E │T │E │R │  │H │U │G │H │ row 1    │
│  │ T0  │ ├──┼──┤  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤          │
│  │     │ │T3│T4│  │E │S │  │  │  │  │  │  │  │  │ row 2    │
│  └─────┘ └──┴──┘  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤          │
│                   │  │  │  │  │  │  │  │  │  │  │ row 3    │
│                   └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘          │
│                                                            │
│  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐         │
│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │ row 1   │
│  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤         │
│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │ row 2   │
│  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤         │
│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │ row 3   │
│  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤         │
│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │ row 4   │
│  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤         │
│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │ row 5   │
│  └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘         │
└────────────────────────────────────────────────────────────┘
```

### Dimensions (nominal, mm)

| Element        | Width | Height | Notes                       |
|----------------|-------|--------|-----------------------------|
| Glyph total    | 24.0  | 14.0   |                             |
| Quiet zone     | 1.0   | 1.0    | All sides                   |
| T0 square      | 3.0   | 3.0    | Large triage indicator      |
| T1–T4 quadrant | 3.0   | 3.0    | 2×2 of 1.5mm cells          |
| Name block     | 15.0  | 3.0    | 10 cols × 3 rows, 1.5×1mm   |
| Data grid      | 22.0  | 6.88   | 16 cols × 5 rows, ~1.375mm  |

## 3. Human zone

### 3.1 Triage indicators

Unchanged from v2.0: T0 big red square lights up when any PAUSE condition is set; T1–T4 each light up in their tier colour when at least one condition in that tier is present. T4 also lights when a phone is set.

### 3.2 Name block (calibration + identity)

- **Grid:** 10 columns × 3 rows = 30 cells.
- **Content:** Patient full name, uppercase, flowing left-to-right and top-to-bottom. Characters: `A–Z`, space, hyphen. Truncated at 30 characters. Multiple spaces collapsed. Leading/trailing whitespace stripped.
- **Letter rendering:** Black on light cells, white on dark cells (chosen per-cell via luminance).
- **Calibration colouring:** Each cell's background colour is fixed by position — *independent of name content*. The 30-cell pattern covers all 16 palette colours, spatially distributed, with each colour appearing once or twice:

  ```
  Row 1: [ 0  8  1  9  2 10  3 11  4 12]
  Row 2: [ 5 13  6 14  7 15  0  8  1  9]
  Row 3: [10  2 11  3 12  4 13  5 14  6]
  ```

  The decoder samples these 30 cells at known positions to build a colour-correction LUT for the data grid.

## 4. Machine zone (16×5 data grid)

Pure colour cells. No letters. 80 nibbles × 4 bits = 320 bits = 40 bytes.

### 4.1 Byte map

| Bytes   | Field             | Detail                                            |
|---------|-------------------|---------------------------------------------------|
| 0       | Version           | `0x30` (v3.0)                                     |
| 1       | Flags             | Tier presence bitmask (bits 0–4 = T0–T4)          |
| 2–4     | Date of birth     | YY / MM / DD                                      |
| 5       | Blood type        | Index into `BLOOD_TYPES`                          |
| 6–7     | Reserved          | Zero-filled                                       |
| 8–13    | Phone (ICE)       | 12 BCD digits                                     |
| 14–32   | Condition bitfield| 19 bytes (152 bits) for 145 conditions            |
| 33–37   | Reserved          | Zero-filled                                       |
| 38–39   | CRC-16            | CRC-16/CCITT-FALSE over bytes 0–37                |

Row 1 of the data grid (bytes 0–7) carries the header; rows 2–5 (bytes 8–39) carry phone, conditions, reserved, and CRC.

### 4.2 CRC

CRC-16/CCITT-FALSE (poly `0x1021`, init `0xFFFF`, no reflection, no XOR-out). Computed over bytes 0–37 at encode time, stored big-endian in bytes 38–39. Decoder verifies and rejects on mismatch.

## 5. Decode pipeline

1. **Locate** the glyph bounds (non-white content bbox).
2. **Orient** using the asymmetric top zone as fiducial (T0 square on the left, name block on the right).
3. **Sample calibration cells** — the 30 known-colour name-block cells — from their corner regions (letter strokes sit in the centre, colour fill is clean at the corners).
4. **Build LUT** — for each of the 16 palette colours, compute the mean observed RGB from its calibration cells (1 or 2 samples each). This becomes the per-glyph reference palette.
5. **Classify data cells** — for each of the 80 data cells, sample 6 interior points, majority-vote the match against the calibrated palette.
6. **Verify CRC.** If fails, still return the data but flag an error.
7. **OCR the name block** (optional, best-effort): for each of the 30 name cells, segment the letter pixels (they are a fixed contrast colour against the known calibrated cell colour) and match to a template.

## 6. Breaking changes from v2.0

- Name is no longer encoded in the data grid (saves 9 bytes).
- Name capacity: 12 → 30 chars.
- DOB and blood type move from mid-grid to header row.
- Data grid has **no** letter overlays.
- Version byte is `0x30`.
- CRC-16 added at the end.
- Physical size grows from 18×10mm to 24×14mm.

## 7. Open questions (post-v3.0)

- In-glyph OCR template library for offline name readback.
- 5-bit palette (32 colours) now viable thanks to calibration. Would double data capacity.
- Error-correction (Reed–Solomon) layer in the reserved bytes.
