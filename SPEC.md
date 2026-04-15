# MediglyphCode Specification v3.0

**Status:** Draft
**Supersedes:** v2.0 (breaking change)
**Physical size:** 24mm × 14mm (watch-strap, top-of-wrist)

## 1. Design principles

v3.0 separates the glyph into three responsibilities:

- **Triage zone** (top-left): eye-readable severity indicators (T0 + T1–T4).
- **Calibration zone** (top-right): 10×3 block of fixed-colour cells, one per palette index, used by the decoder to build a per-photograph colour-correction LUT.
- **Data zone** (bottom): 16×5 pure colour grid carrying the machine-readable payload. No letter overlays.

**Patient identity is not carried inside the glyph.** The eye-readable name is the responsibility of the physical product — bracelet, card, sticker, pendant — which prints the name alongside the glyph as normal typography. This keeps the glyph a pure colour artefact, removes OCR from the decode path, and preserves the full 30-cell calibration reference. A compliant product MUST display the name in legible type adjacent to the glyph (conventionally above or to the side).

The glyph-in-isolation payload is therefore *patient context*, not *patient identity*. A decoder receiving a cropped image containing only the glyph will return an empty `name` field and no warning.

## 2. Physical layout

```
┌────────────────────────────────────────────────────────────┐
│                     1mm quiet zone                         │
│                 (patient name printed here by product)     │
│  ┌─────┐ ┌──┬──┐  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐          │
│  │     │ │T1│T2│  │  │  │  │  │  │  │  │  │  │  │ row 1    │
│  │ T0  │ ├──┼──┤  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤          │
│  │     │ │T3│T4│  │  │  │  │  │  │  │  │  │  │  │ row 2    │
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
| Calibration    | 15.0  | 3.0    | 10 cols × 3 rows, 1.5×1mm   |
| Data grid      | 22.0  | 6.88   | 16 cols × 5 rows, ~1.375mm  |

## 3. Human zone

### 3.1 Triage indicators

Unchanged from v2.0: T0 big red square lights up when any PAUSE condition is set; T1–T4 each light up in their tier colour when at least one condition in that tier is present. T4 also lights when a phone is set.

### 3.2 Calibration block

- **Grid:** 10 columns × 3 rows = 30 cells, pure colour (no overlays).
- **Pattern:** fixed across every glyph, independent of patient data. Each cell's palette index is:

  ```
  Row 1: [ 0  8  1  9  2 10  3 11  4 12]
  Row 2: [ 5 13  6 14  7 15  0  8  1  9]
  Row 3: [10  2 11  3 12  4 13  5 14  6]
  ```

  Every one of the 16 palette colours appears at least once, spatially distributed so localised lighting gradients do not wipe out any colour's only reference.

- **Decoder use:** sample all 30 cells, group observations by intended palette index, compute per-index mean RGB. The resulting 16-entry LUT replaces the canonical palette for classifying the data grid.

### 3.3 External name

A compliant physical product displays the patient's name in legible typography adjacent to the glyph. Conventionally above; beside is also acceptable. There are no encoding rules — it is ordinary printed text, at whatever font, size, and weight the product designer chooses. The glyph itself carries no letters.

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
3. **Sample calibration cells** — the 30 known-colour cells in the top-right block.
4. **Build LUT** — for each of the 16 palette colours, compute the mean observed RGB from its calibration cells (1 or 2 samples each). This becomes the per-glyph reference palette.
5. **Classify data cells** — for each of the 80 data cells, sample 6 interior points, majority-vote the match against the calibrated palette.
6. **Verify CRC.** If fails, still return the data but flag an error.
7. **Name** is not decoded — the decoder returns `name: ''`. Consuming applications should display the name from the photograph itself (printed adjacent to the glyph by the physical product) or from external records.

## 6. Breaking changes from v2.0

- Name is no longer encoded anywhere in the glyph — it is printed externally by the physical product as normal typography.
- DOB and blood type move from mid-grid to header row of the data grid.
- Data grid has **no** letter overlays.
- The former "name block" becomes a pure-colour calibration reference.
- Version byte is `0x30`.
- CRC-16 added at the end.
- Physical size grows from 18×10mm to 24×14mm.

## 7. Open questions (post-v3.0)

- Short "handle" field (8 chars) in the reserved bytes for applications that may receive glyph-only crops without surrounding name text.
- 5-bit palette (32 colours) now viable thanks to calibration. Would double data capacity.
- Error-correction (Reed–Solomon) layer in the reserved bytes.
