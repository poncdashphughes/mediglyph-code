# MediglyphCode Specification v4.0 — DRAFT

**Status:** Draft for discussion — not implemented
**Supersedes:** v3.1 (breaking change to physical layout and byte map)
**Physical size:** 24mm × 15mm (band), with card/sheet variants
**Implemented spec:** see [SPEC.md](SPEC.md) (v3.1)

## 1. Design principles

v4.0 is designed around the three moments of a first-responder encounter:

1. **Glance (0–15 s, no phone).** Eye-readable triage indicators plus a
   printed headline of the most critical conditions in plain text.
2. **Scan (30–90 s).** Full decode of the colour grid: identity
   cross-check, DOB, blood type, ICE phone, complete condition list.
3. **Bad scan (gloves, rain, torchlight, a worn band).** A degraded
   image that cannot sustain a full decode must still yield the
   life-threat picture. v4 introduces a self-contained critical first
   row for exactly this case.

Two further principles carry over and harden:

- **Text is typography, colour is data.** The glyph remains a pure
  colour artefact at band scale. Human-readable text (name, headline)
  is printed by the physical product. Letter overlays on data cells are
  permitted only at large scale (§8).
- **Reliability beats density.** The palette stays at 16 colours.
  Capacity gains are spent on error correction and graceful
  degradation, not payload.

## 2. Physical layout

```
┌──────────────────────────────────────────────────────────────┐
│                     1mm quiet zone                           │
│        (name + headline printed here by product)             │
│  ┌─────┐ ┌──┬──┐  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐            │
│  │ T0  │ │T1│T2│  │      calibration block      │            │
│  │     │ ├──┼──┤  │      (10 × 3, unchanged)    │            │
│  └─────┘ │T3│T4│  └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘            │
│          └──┴──┘                                             │
│  ━━━━━━━━━━━━━━━━ top anchor bar (0.4mm) ━━━━━━━━━━━━━━━━━   │
│  ┌──┬──┬──┬──┬─ CRITICAL ROW (16 cells, row 1) ─┬──┬──┬──┐   │
│  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤           │
│  │      full record (rows 2–6, 80 cells)         │           │
│  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤           │
│  └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘           │
│  ━━━━━━━━━━━━━━ bottom anchor bar (0.4mm) ━━━━━━━━━━━━━━━━   │
│                     1mm quiet zone                           │
└──────────────────────────────────────────────────────────────┘
```

### Dimensions (nominal, mm)

| Element        | Width | Height | Notes                              |
|----------------|-------|--------|------------------------------------|
| Glyph total    | 24.0  | 15.0   | +1mm height vs v3                  |
| Quiet zone     | 1.0   | 1.0    | All sides                          |
| Human zone     | 22.0  | 3.0    | T0, T1–T4, calibration — unchanged |
| Anchor bars    | 22.0  | 0.4    | Solid black, above and below grid  |
| Data grid      | 22.0  | 8.25   | 16 cols × 6 rows, ~1.375mm cells   |

### 2.1 Anchor bars

Two solid black bars run the full grid width, directly above and below
the data grid. They serve three decoder functions:

- **Location** — a high-contrast straight feature that survives clutter
  far better than content-bounds heuristics.
- **Orientation and tilt** — the bar pair plus the asymmetric human
  zone (T0 left, calibration right) disambiguates all four orientations
  and gives a precise rotation estimate.
- **Curvature** — on a wrist the band is a cylinder section, not a flat
  card. The bars render as gentle arcs; fitting those arcs yields the
  cylindrical correction applied to the sampling lattice. This replaces
  the v3 assumption of a flat, upright glyph.

### 2.2 Product requirements (normative)

A compliant physical product MUST:

- Print the patient name in legible type adjacent to the glyph.
- Print the **headline line**: the highest-priority conditions (up to
  three, T0 first, then T1 allergies) rendered as plain text, generated
  by the encoder from the encoded data so text and glyph cannot
  disagree.
- Carry a recognised medical identifier (Star of Life or equivalent) so
  responders look at the band at all.

A compliant product SHOULD print the decoder URL (or a QR pointing to
it) on the band, clasp, or packaging — the colour grid needs the
Mediglyph decoder; discoverability is part of the safety case.

## 3. Byte map (48 bytes, 96 cells)

### 3.1 Critical row — row 1, bytes 0–7 (self-contained)

| Byte | Field | Detail |
|------|-------|--------|
| 0 | Version | `0x40` |
| 1 | Flags | Tier presence bits 0–4, bit 5 = phone present |
| 2 | Blood type | Index into `BLOOD_TYPES` |
| 3–6 | Critical conditions | Up to four condition codes, highest priority first; `0xFF` = unused slot |
| 7 | CRC-8 | Over bytes 0–6 |

The critical row validates **on its own**: 16 cells, its own checksum,
no dependency on the rest of the grid. A decoder that cannot complete a
full decode reports the critical row as a clearly-marked partial result
("provisional — full record unreadable"). Acceptance requires byte 0 =
`0x40` AND a CRC-8 match.

### 3.2 Full record — rows 2–6, bytes 8–47

| Bytes | Field | Detail |
|-------|-------|--------|
| 8–10  | Date of birth | YY / MM / DD |
| 11–12 | Initials | Three 5-bit characters (A–Z, space); identity cross-check against the printed name |
| 13–18 | Phone (ICE) | 12 BCD digits |
| 19–37 | Condition bitfield | 19 bytes (152 bits) for 145 conditions — unchanged from v3 |
| 38–45 | RS parity | Reed–Solomon over bytes 0–37 |
| 46–47 | CRC-16 | CCITT-FALSE over bytes 0–45 |

### 3.3 Error correction

Eight parity bytes (vs five in v3.1) over the 38 data bytes — the
codeword covers the critical row too, so a full decode gives the
critical fields double protection. Corrects up to **4 bytes blind, or
up to 8 flagged as erasures** by sampler confidence (`2e + f ≤ 8`).
Field and codec are unchanged from v3.1 (GF(2⁸), poly `0x11D`, α = 2).

Decode order mirrors v3.1: CRC-16 fast path → RS with erasures → RS
errors-only → re-verify CRC → CRC-cells-damaged warning path → fall
back to the standalone critical row before reporting failure.

## 4. Decoder requirements

- **Verification-driven**: no geometric assumption (orientation,
  rotation, curvature) is trusted until a decode validates. Try all
  four orientations.
- **Curvature-aware**: fit the anchor-bar arcs; sample the grid through
  a curved four-corner lattice rather than a uniform flat grid.
- **Continuous capture**: decode every camera frame and fuse per-cell
  confidence across frames; stop on validation. Single-shot capture is
  a fallback, not the primary mode.
- **Triage-first display**: results ordered T0 conditions (large,
  red), constraints/allergies, blood + DOB, contacts, context. The
  initials field is cross-checked against any OCR'd printed name and
  mismatches are flagged.
- **v3 compatibility**: decoders SHOULD retain the v3.x pipeline and
  select by validated result.

## 5. Card and sheet variants

The same byte map at larger physical sizes. Cell pitch scales with the
medium; the anchor bars and zone proportions are preserved.

**Letter overlays** (the v2.0 feature) are permitted **only** where the
data-cell pitch is ≥ 3mm — in practice card formats and larger. At that
scale corner-sampling margin is ample and the text is legible; at band
scale overlaid letters are below arm's-length legibility and spend RS
margin on self-inflicted contamination. Overlays MUST NOT be applied to
the calibration block, the anchor bars, or the critical row.

## 6. Compatibility

v4.0 is a breaking change (new size, anchor bars, six rows, new byte
map). v3.1 glyphs remain decodable by the retained v3 pipeline. There
is no in-place upgrade: a v3 band is replaced, not reflashed.

## 7. Pre-implementation validation (gate for leaving draft)

- **Curved print trial**: v4 test glyphs on actual silicone band stock,
  worn, photographed at angles — decode-rate data drives final cell and
  bar dimensions.
- **Wear protocol**: abrasion, sunscreen, UV fade on printed samples;
  results size the parity budget (8 bytes is the working assumption,
  not a conclusion).
- **Glance study**: can responders read the headline + tier lights in
  under 5 seconds at arm's length? Iterate type size before locking the
  product rules.

## 8. Open questions

- 32-colour palette (5 bits/cell) once calibration-under-wear data
  exists — would roughly double capacity or halve glyph size.
- Optional NFC complement in the band hardware for services that
  standardise on it (the colour grid remains the no-infrastructure
  path).
- Paediatric variant: weight band field for dosing in place of phone
  digits?
- Second ICE contact at card scale (larger grid).
