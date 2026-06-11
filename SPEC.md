# MediglyphCode Specification v3.1

**Status:** Draft
**Supersedes:** v3.0 (compatible extension — adds error correction in the reserved bytes), which superseded v2.0 (breaking change)
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
| 0       | Version           | `0x31` (v3.1)                                     |
| 1       | Flags             | Tier presence bitmask (bits 0–4 = T0–T4)          |
| 2–4     | Date of birth     | YY / MM / DD                                      |
| 5       | Blood type        | Index into `BLOOD_TYPES`                          |
| 6–7     | Reserved          | Zero-filled                                       |
| 8–13    | Phone (ICE)       | 12 BCD digits                                     |
| 14–32   | Condition bitfield| 19 bytes (152 bits) for 145 conditions            |
| 33–37   | RS parity         | Reed–Solomon parity over bytes 0–32 (zero in v3.0)|
| 38–39   | CRC-16            | CRC-16/CCITT-FALSE over bytes 0–37                |

Row 1 of the data grid (bytes 0–7) carries the header; rows 2–5 (bytes 8–39) carry phone, conditions, parity, and CRC.

### 4.2 CRC

CRC-16/CCITT-FALSE (poly `0x1021`, init `0xFFFF`, no reflection, no XOR-out). Computed over bytes 0–37 at encode time — parity bytes included — stored big-endian in bytes 38–39. The CRC is the final arbiter of decode validity.

### 4.3 Error correction (v3.1)

Bytes 33–37 carry five Reed–Solomon parity bytes over GF(2⁸) (primitive polynomial `0x11D`, generator `α = 2` — the QR-code field), computed over data bytes 0–32. The codeword is bytes 0–37: 33 data + 5 parity.

**Correction capacity:** up to 2 misread bytes at unknown positions, or up to 5 bytes at known-suspect positions (erasures), with mixes bounded by `2e + f ≤ 5`. The decoder treats data cells whose colour classification has low confidence as erasures, so realistic damage — glare, smudges, blur — gets the higher budget.

**Decode order:**

1. Verify CRC. On match, accept (fast path — also how v3.0 glyphs decode).
2. On mismatch, attempt RS correction of bytes 0–37, first with the sampler's erasure hints, then errors-only.
3. Re-verify the stored CRC against the corrected codeword. On match, accept and report the number of repaired bytes.
4. If the corrected codeword is RS-valid but the stored CRC still disagrees, the CRC cells themselves (which sit outside RS coverage) are the damaged ones: accept the data with an explicit warning that it was validated by error correction only. This path requires the corrected version byte to read `0x31`.
5. Otherwise reject with a CRC error, exactly as v3.0 did.

**Compatibility:** v3.0 decoders ignore bytes 33–37 and verify the CRC over 0–37, so they read v3.1 glyphs unchanged. v3.1 decoders read v3.0 glyphs through the fast path; a damaged v3.0 glyph cannot be "repaired" into garbage because its zeroed parity is not a valid codeword and the recovered output must still satisfy the stored CRC.

## 5. Decode pipeline

1. **Locate** the glyph bounds (non-white content bbox).
2. **Orient** using the asymmetric top zone as fiducial (T0 square on the left, name block on the right).
3. **Sample calibration cells** — the 30 known-colour cells in the top-right block.
4. **Build LUT** — for each of the 16 palette colours, compute the mean observed RGB from its calibration cells (1 or 2 samples each). This becomes the per-glyph reference palette.
5. **Classify data cells** — for each of the 80 data cells, sample 9 interior points, majority-vote the match against the calibrated palette, and record per-cell confidence.
6. **Verify and repair** — check the CRC; on mismatch, attempt Reed–Solomon correction (low-confidence cells as erasures) per §4.3, then re-verify. Only flag an error when repair fails too.
7. **Name** is not decoded — the decoder returns `name: ''`. Consuming applications should display the name from the photograph itself (printed adjacent to the glyph by the physical product) or from external records.

Rotation handling: the preprocessor estimates tilt from the bottom edge of the saturated pixel cloud (Theil–Sen median slope) and de-rotates when the tilt exceeds 1°. If a decode attempt with rotation correction fails to validate, the decoder retries without it — a misestimated angle must never break an image that was straight to begin with.

## 6. Breaking changes from v2.0

- Name is no longer encoded anywhere in the glyph — it is printed externally by the physical product as normal typography.
- DOB and blood type move from mid-grid to header row of the data grid.
- Data grid has **no** letter overlays.
- The former "name block" becomes a pure-colour calibration reference.
- Version byte is `0x30`.
- CRC-16 added at the end.
- Physical size grows from 18×10mm to 24×14mm.

## 7. Open questions (post-v3.1)

- Short "handle" field in bytes 6–7 for applications that may receive glyph-only crops without surrounding name text. (Bytes 33–37 are no longer available — v3.1 spent them on error correction.)
- 5-bit palette (32 colours) now viable thanks to calibration. Would double data capacity, some of which could buy deeper RS parity.

Both are addressed in the next-version proposal: see [SPEC-v4-draft.md](SPEC-v4-draft.md) (self-contained critical row, initials field, anchor bars for curved-band decoding, deeper parity, scale-conditional letter overlays).
