import './styles/global.css';
import './pwa/register-sw';
import type { PatientData } from './core/types';
import { TIER_COLOURS, TIER_LABELS, BLOOD_TYPES } from './core/palette';
import { CONDITIONS, getConditionsForTier, getSubcategoriesForTier, SUBCATEGORY_LABELS, CONDITIONS_MAP, TOTAL_SELECTABLE_CONDITIONS } from './core/conditions';
import { renderGlyph } from './encoder/glyph-renderer';
import { downloadPNG, downloadSVG, copyHexData } from './encoder/export';
import { decodeFromImage } from './decoder/decode-pipeline';
import { CameraManager } from './decoder/camera';

// ── State ──
const patient: PatientData = {
  name: 'Peter Hughes',
  dob: '1985-03-15',
  blood: 8,
  tier0: [],
  tier1: [],
  tier2: [],
  tier3: [],
  phone: '+447700900123',
};

let lastEncodedData: number[] = [];
let decoderImageCanvas: HTMLCanvasElement | null = null;
let decoderImageCtx: CanvasRenderingContext2D | null = null;
let camera: CameraManager | null = null;

// ── DOM References ──
const $ = (id: string) => document.getElementById(id)!;

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initEncoderForm();
  initConditionPickers();
  initExportButtons();
  initDecoder();
  updateGlyph();
});

// ── Tab Navigation ──
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = (tab as HTMLElement).dataset.tab!;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      $(`${target}View`).classList.add('active');

      // Stop camera when switching away from decoder
      if (target !== 'decoder' && camera?.isActive) {
        camera.stop();
        $('cameraSection').style.display = 'none';
        $('toggleCamera').textContent = 'Open Camera';
        $('captureBtn').style.display = 'none';
        $('switchCamera').style.display = 'none';
      }
    });
  });
}

// ── Encoder Form ──
function initEncoderForm() {
  const nameInput = $('patientName') as HTMLInputElement;
  const dobInput = $('patientDOB') as HTMLInputElement;
  const bloodSelect = $('patientBlood') as HTMLSelectElement;
  const phoneInput = $('icePhone') as HTMLInputElement;

  const onChange = () => {
    patient.name = nameInput.value;
    patient.dob = dobInput.value;
    patient.blood = parseInt(bloodSelect.value);
    patient.phone = phoneInput.value;
    updateGlyph();
  };

  nameInput.addEventListener('input', onChange);
  dobInput.addEventListener('change', onChange);
  bloodSelect.addEventListener('change', onChange);
  phoneInput.addEventListener('input', onChange);
}

// ── Condition Pickers ──
function initConditionPickers() {
  const container = $('tierSelectors');
  const searchInput = $('conditionSearch') as HTMLInputElement;

  // Build tier accordion sections
  for (let tier = 0; tier <= 3; tier++) {
    const t = tier as 0 | 1 | 2 | 3;
    const conditions = getConditionsForTier(t);
    const subcategories = getSubcategoriesForTier(t);

    const section = document.createElement('div');
    section.className = 'tier-selector';
    section.dataset.tier = String(tier);

    // Header
    const header = document.createElement('div');
    header.className = 'tier-header';
    header.innerHTML = `
      <div class="tier-dot" style="background: ${TIER_COLOURS[tier]}"></div>
      <span class="tier-label">T${tier} — ${TIER_LABELS[tier].name} <span style="color: var(--text-muted); font-weight: 400;">(${TIER_LABELS[tier].meaning})</span></span>
      <span class="tier-count" data-tier-count="${tier}" style="display: none;">0</span>
      <span class="tier-chevron">&#9654;</span>
    `;
    header.addEventListener('click', () => {
      section.classList.toggle('expanded');
    });

    // Body
    const body = document.createElement('div');
    body.className = 'tier-body';

    // Subcategory tabs (only if more than 1)
    if (subcategories.length > 1) {
      const tabs = document.createElement('div');
      tabs.className = 'subcategory-tabs';

      const allTab = document.createElement('button');
      allTab.className = 'subcategory-tab active';
      allTab.textContent = 'All';
      allTab.addEventListener('click', () => {
        tabs.querySelectorAll('.subcategory-tab').forEach(t => t.classList.remove('active'));
        allTab.classList.add('active');
        filterChips(body, '', '');
      });
      tabs.appendChild(allTab);

      subcategories.forEach(sub => {
        const tab = document.createElement('button');
        tab.className = 'subcategory-tab';
        tab.textContent = SUBCATEGORY_LABELS[sub] || sub;
        tab.addEventListener('click', () => {
          tabs.querySelectorAll('.subcategory-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          filterChips(body, sub, '');
        });
        tabs.appendChild(tab);
      });

      body.appendChild(tabs);
    }

    // Condition chips
    const chips = document.createElement('div');
    chips.className = 'condition-chips';

    conditions.forEach(cond => {
      const chip = document.createElement('span');
      chip.className = 'condition-chip';
      chip.textContent = cond.shortLabel;
      chip.dataset.code = cond.code;
      chip.dataset.tier = String(tier);
      chip.dataset.subcategory = cond.subcategory;
      chip.dataset.searchText = cond.label.toLowerCase();

      chip.addEventListener('click', () => {
        const tierKey = `tier${tier}` as keyof PatientData;
        const arr = patient[tierKey] as string[];
        const idx = arr.indexOf(cond.code);

        if (idx >= 0) {
          arr.splice(idx, 1);
          chip.classList.remove('selected');
        } else {
          arr.push(cond.code);
          chip.classList.add('selected');
        }

        updateCapacity();
        updateGlyph();
      });

      chips.appendChild(chip);
    });

    body.appendChild(chips);
    section.appendChild(header);
    section.appendChild(body);
    container.appendChild(section);
  }

  // Global search
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    document.querySelectorAll('.condition-chip').forEach(chip => {
      const el = chip as HTMLElement;
      const text = el.dataset.searchText || '';
      el.style.display = text.includes(query) ? '' : 'none';
    });

    // Expand tiers that have visible chips
    if (query) {
      document.querySelectorAll('.tier-selector').forEach(s => {
        const hasVisible = s.querySelector('.condition-chip:not([style*="display: none"])');
        if (hasVisible) s.classList.add('expanded');
      });
    }
  });
}

function filterChips(body: HTMLElement, subcategory: string, _search: string) {
  body.querySelectorAll('.condition-chip').forEach(chip => {
    const el = chip as HTMLElement;
    const matchesSub = !subcategory || el.dataset.subcategory === subcategory;
    el.style.display = matchesSub ? '' : 'none';
  });
}

function updateCapacity() {
  const total = patient.tier0.length + patient.tier1.length + patient.tier2.length + patient.tier3.length;
  const fill = $('capacityFill') as HTMLElement;
  const text = $('capacityText');
  const max = TOTAL_SELECTABLE_CONDITIONS;
  const pct = (total / max) * 100;

  fill.style.width = `${pct}%`;
  fill.className = 'capacity-fill' + (pct >= 90 ? ' warning' : '');
  text.textContent = `${total} condition${total !== 1 ? 's' : ''} selected`;

  // Update tier counts
  for (let t = 0; t <= 3; t++) {
    const tierKey = `tier${t}` as keyof PatientData;
    const count = (patient[tierKey] as string[]).length;
    const badge = document.querySelector(`[data-tier-count="${t}"]`) as HTMLElement;
    if (badge) {
      badge.textContent = String(count);
      badge.style.display = count > 0 ? '' : 'none';
    }
  }
}

// ── Glyph Rendering ──
function updateGlyph() {
  const canvas = $('glyphCanvas') as HTMLCanvasElement;
  const result = renderGlyph(canvas, patient);
  lastEncodedData = result.encodedData;
}

// ── Export Buttons ──
function initExportButtons() {
  $('downloadPng').addEventListener('click', () => {
    const canvas = $('glyphCanvas') as HTMLCanvasElement;
    const safeName = patient.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    downloadPNG(canvas, `mediglyph-${safeName}.png`);
  });

  $('downloadSvg').addEventListener('click', () => {
    const safeName = patient.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    downloadSVG(patient, `mediglyph-${safeName}.svg`);
  });

  $('copyData').addEventListener('click', async () => {
    await copyHexData(lastEncodedData);
    const btn = $('copyData');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Hex'; }, 1500);
  });
}

// ── Decoder ──
function initDecoder() {
  const dropZone = $('dropZone');
  const fileInput = $('fileInput') as HTMLInputElement;
  const previewImg = $('previewImg') as HTMLImageElement;

  // Drop zone click
  dropZone.addEventListener('click', () => fileInput.click());

  // Drag events
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file) loadImageFile(file);
  });

  // File input
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) loadImageFile(file);
  });

  // Decode button
  $('decodeBtn').addEventListener('click', () => {
    if (decoderImageCanvas && decoderImageCtx) {
      const result = decodeFromImage(decoderImageCanvas, decoderImageCtx);
      displayDecodedData(result);
    }
  });

  // Camera controls
  $('toggleCamera').addEventListener('click', toggleCamera);
  $('captureBtn').addEventListener('click', captureFromCamera);
  $('switchCamera').addEventListener('click', () => camera?.switchCamera());
}

function loadImageFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      // Show preview
      ($('previewImg') as HTMLImageElement).src = img.src;
      $('uploadedPreview').classList.add('visible');
      $('decodeBtn').style.display = 'block';

      // Create canvas for decoding
      decoderImageCanvas = document.createElement('canvas');
      decoderImageCanvas.width = img.width;
      decoderImageCanvas.height = img.height;
      decoderImageCtx = decoderImageCanvas.getContext('2d')!;
      decoderImageCtx.drawImage(img, 0, 0);
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}

async function toggleCamera() {
  const section = $('cameraSection');
  const btn = $('toggleCamera');

  if (camera?.isActive) {
    camera.stop();
    section.style.display = 'none';
    btn.textContent = 'Open Camera';
    $('captureBtn').style.display = 'none';
    $('switchCamera').style.display = 'none';
  } else {
    try {
      const video = $('cameraVideo') as HTMLVideoElement;
      camera = new CameraManager(video);
      await camera.start();
      section.style.display = 'block';
      btn.textContent = 'Close Camera';
      $('captureBtn').style.display = '';
      $('switchCamera').style.display = '';
    } catch (err) {
      alert(`Camera error: ${(err as Error).message}`);
    }
  }
}

function captureFromCamera() {
  if (!camera?.isActive) return;

  const { canvas, ctx } = camera.captureFrame();
  decoderImageCanvas = canvas;
  decoderImageCtx = ctx;

  // Show captured frame as preview
  ($('previewImg') as HTMLImageElement).src = canvas.toDataURL();
  $('uploadedPreview').classList.add('visible');
  $('decodeBtn').style.display = 'block';

  // Auto-decode
  const result = decodeFromImage(canvas, ctx);
  displayDecodedData(result);
}

function displayDecodedData(decoded: import('./core/types').DecodedResult) {
  const output = $('decodedOutput');
  output.classList.add('visible');

  $('decodedName').textContent = decoded.name || '\u2014';

  const metaParts: string[] = [];
  if (decoded.dob) metaParts.push(`DOB: ${decoded.dob}`);
  if (decoded.blood) metaParts.push(`Blood: ${decoded.blood}`);
  const confidence = (decoded.debug?.confidence as number) || 0;
  if (confidence > 0) metaParts.push(`Confidence: ${Math.round(confidence * 100)}%`);
  $('decodedMeta').textContent = metaParts.join(' \u2022 ') || '\u2014';

  const tiersEl = $('decodedTiers');
  tiersEl.innerHTML = '';

  if (decoded.error) {
    tiersEl.innerHTML = `
      <div class="decoded-tier" style="background: rgba(217,38,38,0.1); border-left: 3px solid var(--tier-0);">
        <div class="decoded-tier-content">
          <div class="decoded-tier-label">Error</div>
          <div class="decoded-tier-value">${decoded.error}</div>
        </div>
      </div>
    `;
  }

  // Human Zone status
  if (decoded.humanZone) {
    const hz = decoded.humanZone;
    tiersEl.innerHTML += `
      <div class="decoded-tier" style="background: rgba(74,144,217,0.1);">
        <div class="decoded-tier-dot" style="background: var(--accent)"></div>
        <div class="decoded-tier-content">
          <div class="decoded-tier-label">Human Zone (Orientation Anchor)</div>
          <div class="decoded-tier-value" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
            ${[0,1,2,3,4].map(t => {
              const active = hz[`tier${t}` as keyof typeof hz];
              return `<span style="padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; ${active ? `background: ${TIER_COLOURS[t]}; color: #fff;` : 'background: var(--bg-input); color: var(--text-muted);'}">T${t}${active ? ' \u2713' : ''}</span>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Tier conditions
  const tierConfigs = [
    { key: 'tier0', label: `T0 \u2014 ${TIER_LABELS[0].name}`, colour: TIER_COLOURS[0] },
    { key: 'tier1', label: `T1 \u2014 ${TIER_LABELS[1].name}`, colour: TIER_COLOURS[1] },
    { key: 'tier2', label: `T2 \u2014 ${TIER_LABELS[2].name}`, colour: TIER_COLOURS[2] },
    { key: 'tier3', label: `T3 \u2014 ${TIER_LABELS[3].name}`, colour: TIER_COLOURS[3] },
  ];

  tierConfigs.forEach(tc => {
    const items = decoded[tc.key as keyof typeof decoded] as string[];
    if (!items || items.length === 0) return;

    tiersEl.innerHTML += `
      <div class="decoded-tier">
        <div class="decoded-tier-dot" style="background: ${tc.colour}"></div>
        <div class="decoded-tier-content">
          <div class="decoded-tier-label">${tc.label}</div>
          <div class="decoded-tier-value">${items.join(', ')}</div>
        </div>
      </div>
    `;
  });

  // Phone
  if (decoded.phone) {
    tiersEl.innerHTML += `
      <div class="decoded-tier">
        <div class="decoded-tier-dot" style="background: ${TIER_COLOURS[4]}"></div>
        <div class="decoded-tier-content">
          <div class="decoded-tier-label">T4 \u2014 ${TIER_LABELS[4].name}</div>
          <div class="decoded-tier-value">${decoded.phone}</div>
        </div>
      </div>
    `;
  }

  // Debug
  $('debugPre').textContent = JSON.stringify(decoded, null, 2);
}
