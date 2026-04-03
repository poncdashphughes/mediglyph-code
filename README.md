# MediglyphCode

Medical bracelets engrave a handful of words onto a strip of metal. Four conditions, maybe five if the text is small. For someone managing epilepsy, a drug allergy, a pacemaker, and a communication need, that bracelet is already full before it has said anything useful.

MediglyphCode encodes up to **145 medical conditions** into an **18mm x 10mm** colour glyph. It is small enough to fit on a wristband, a card, or a sticker, and readable by any smartphone camera.

**[Live demo](https://poncdashphughes.github.io/mediglyph-code/)**

## The problem

Traditional medical identification has not changed meaningfully in decades. Engraved bracelets carry three to four conditions in plain text that wears off over time. QR codes require connectivity. NFC tags need compatible hardware. None of these solve the core problem: getting a clinically useful picture of a patient to a first responder, quickly, without infrastructure.

MediglyphCode takes a different approach. Each glyph is a structured colour grid that encodes identity, conditions, allergies, medications, communication needs, and emergency contacts into a format that works in two ways simultaneously: the human-readable zone gives immediate visual triage information, while the full data grid can be decoded by a phone camera for the complete clinical picture.

## How it works

### Five-tier triage system

Every condition is assigned to one of five clinical tiers, each with a dedicated colour:

| Tier | Name | Colour | Purpose | Conditions |
|------|------|--------|---------|------------|
| T0 | PAUSE | Red | Life-threatening risks | 16 |
| T1 | CONSTRAINT | Orange | Allergies and contraindications | 40 |
| T2 | CONTEXT | Blue | Chronic conditions | 47 |
| T3 | ATYPICAL | Purple | Communication and physical needs | 30 |
| T4 | CONFIRM | Green | Emergency contacts and references | 13 |

The tier names follow clinical priority. T0 means stop and assess before proceeding. T1 means adjust your treatment plan. T2 provides background that informs decisions. T3 flags communication or physical factors. T4 holds contacts and references.

### Glyph anatomy

```
┌──────────────────────────────────────────┐
│                                          │
│  ┌─────────┐  ┌────┬────┐               │
│  │         │  │ T1 │ T2 │  Human zone   │
│  │   T0    │  ├────┼────┤  (visual       │
│  │  PAUSE  │  │ T3 │ T4 │   triage)     │
│  └─────────┘  └────┴────┘               │
│                                          │
│  P  E  T  E  R  H  U  G  H  E  S  0  …  │
│  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬… │
│  │  │  │  │  │  │  │  │  │  │  │  │  │  │
│  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼… │
│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  Data grid
│  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼… │  (16 × 5
│  │  │  │  │  │  │  │  │  │  │  │  │  │  │   colour
│  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼… │   cells)
│  │  │  │  │  │  │  │  │  │  │  │  │  │  │
│  └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴… │
│                                          │
└──────────────────────────────────────────┘
```

The **human-readable zone** at the top provides immediate visual triage. Active tiers light up in their assigned colour. A red T0 square tells a paramedic there is a life-threatening condition before they reach for a phone.

The **data grid** below is a 16 x 5 matrix of colour cells. Each cell encodes a 4-bit nibble using a 16-colour palette, giving 80 nibbles (40 bytes) of structured binary data.

### Binary format (v2.0)

| Bytes | Field | Detail |
|-------|-------|--------|
| 0 | Version | `0x20` (v2.0) |
| 1 | Flags | Tier presence bitmask |
| 2–10 | Name | 12 characters, 6-bit packed |
| 11–13 | Date of birth | YY/MM/DD |
| 14 | Blood type | Index (A+, A-, B+, B-, AB+, AB-, O+, O-) |
| 15–33 | Condition bitfield | 19 bytes (152 bits) for 145 conditions |
| 34–39 | Phone (ICE) | 12 BCD-encoded digits |

Total: **40 bytes**, encoded as **80 colour cells** in a **16 x 5 grid**.

### Decoding

Decoding works by photographing the glyph and sampling each colour cell using multi-point voting. Six sample points per cell with majority voting and confidence scoring make the decode resilient to camera angle, lighting, and reflections.

No internet connection is required. The decoder runs entirely in the browser.

## Encoding capacity

MediglyphCode covers the conditions most likely to affect emergency treatment decisions:

- **T0 — PAUSE (16):** Pacemaker, ICD, anaphylaxis risk, adrenal insufficiency, haemophilia, anticoagulants, malignant hyperthermia, long QT syndrome, mastocytosis, myasthenia gravis, severe asthma, Addison's disease, hereditary angioedema, heart transplant, pulmonary hypertension, and a general life-threat flag.
- **T1 — CONSTRAINT (40):** Drug allergies (penicillin, sulfa, NSAIDs, opioids, cephalosporins, fluoroquinolones, and more), food allergies (peanuts, tree nuts, shellfish, dairy, gluten, and more), environmental allergies, contraindications (no MRI, no adrenaline, difficult airway), and current medications (insulin, immunosuppressants, chemotherapy, lithium, MAOIs).
- **T2 — CONTEXT (47):** Epilepsy, diabetes (type 1 and 2), heart failure, COPD, Parkinson's, MS, bipolar, schizophrenia, autism, Down syndrome, cystic fibrosis, lupus, CKD, and dozens more across neurological, metabolic, cardiovascular, respiratory, mental health, and developmental categories.
- **T3 — ATYPICAL (30):** Non-verbal, deaf/hard of hearing, blind, wheelchair user, tracheostomy, feeding tube, DNR/DNAR, living will, healthcare proxy, pregnant, organ transplant, and other communication, physical, legal, and circumstantial factors.
- **T4 — CONFIRM (13):** Emergency contacts, GP/PCP, specialist, hospital, pharmacy, insurance, NHS number, and medical record references.

## Tech stack

- **Framework:** Vanilla TypeScript, no runtime dependencies
- **Build:** Vite
- **Deployment:** GitHub Pages with PWA support (offline-capable via service worker)
- **Image processing:** Canvas API for rendering, camera API for decoding

## Development

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:3000`.

```bash
npm run build
```

Builds to `dist/` for production deployment.

## Licence

This project uses a **dual licence** structure:

- **Specification** (encoding format, triage model, data schema, colour palette, grid geometry): [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/)
- **Software** (encoder, decoder, and supporting tools): [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.en.html)

See [LICENCE](LICENCE) for full terms.

### What this means in practice

- **Using the specification** to build your own tools, research, or products: yes, with attribution and share-alike.
- **Using or modifying the software** and making it available over a network: you must release your source code under AGPL-3.0.
- **Manufacturing physical products** (bracelets, tags, cards, stickers, pendants) that carry MediglyphCode glyphs: explicitly permitted and encouraged, no additional licence needed, provided the glyph is generated using AGPL-3.0 compliant tools.
- **Charging end users** to generate or decode MediglyphCode glyphs using software derived from this project: not compatible with the intent of this licence.

### Why this licence structure

MediglyphCode exists to make medical identification better, not to create a toll booth. The specification is open so that anyone can build on the format. The software is AGPL-3.0 so that encoding and decoding tools stay free for the people who need them most: patients, carers, and first responders.

Physical products are a different matter. A bracelet manufacturer adding MediglyphCode glyphs to their products is exactly the kind of adoption this project wants to see. The licence explicitly permits this. What it does not permit is taking the open-source encoder, wrapping it in a paywall, and charging patients to generate their own medical identification.

If you are building something with MediglyphCode and are unsure whether your use case is compatible, please get in touch.

## Status

MediglyphCode is a working proof of concept. The encoder and decoder are functional, the specification is stable at v2.0, and the system has been tested across a range of conditions and device cameras. It has **not** been clinically validated. It is not a medical device. Do not rely on it for clinical decisions without independent verification.

## Contact

Created by **Peter Hughes**.

- Project: [https://poncdashphughes.github.io/mediglyph-code/](https://poncdashphughes.github.io/mediglyph-code/)
- GitHub: [https://github.com/poncdashphughes/mediglyph-code](https://github.com/poncdashphughes/mediglyph-code)
