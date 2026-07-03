/**
 * options.js — Full settings page controller.
 */

import { hashPassword, exportSettings, importSettings, resetSettings } from './storage.js';

// ─── State ────────────────────────────────────────────────────────────────────
let settings = null;

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  settings = await getSettings();
  renderAll();
  attachListeners();
});

// ─── Render ───────────────────────────────────────────────────────────────────
function renderAll() {
  // Privacy section
  setCheck('opt-enabled', settings.enabled);
  setCheck('opt-hoverMode', settings.hoverMode);
  setCheck('opt-fakeChatMode', settings.fakeChatMode);

  // Smart blur
  document.querySelectorAll('[data-key]').forEach((cb) => {
    cb.checked = settings[cb.dataset.key] !== false;
  });

  // Appearance
  renderBlurPresets();
  setVal('opt-blurRadius', settings.blurRadius);
  document.getElementById('blur-radius-val').textContent = `${settings.blurRadius}px`;
  setVal('opt-theme', settings.theme || 'system');

  // Keyboard
  setVal('opt-holdKey', settings.holdKey || 'Control');
  setVal('opt-panicKey', settings.panicKey || 'Escape');
  setVal('opt-panicCount', settings.panicCount || 3);

  // Automation
  setCheck('opt-autoLockEnabled', settings.autoLockEnabled);
  setVal('opt-autoLockTimeout', settings.autoLockTimeout || 60);
  setCheck('opt-scheduleEnabled', settings.scheduleEnabled);
  setVal('opt-scheduleStart', settings.scheduleStart || '09:00');
  setVal('opt-scheduleEnd', settings.scheduleEnd || '18:00');
  renderDayPills();
  renderNetworkList();

  // Security
  setCheck('opt-passwordEnabled', settings.passwordEnabled);
  setVal('opt-unlockDuration', settings.unlockDuration || 30);
  togglePasswordSettings(settings.passwordEnabled);
}

function renderBlurPresets() {
  document.querySelectorAll('.pill[data-preset]').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.preset === settings.blurPreset);
  });
}

function renderDayPills() {
  const days = settings.scheduleDays || [1, 2, 3, 4, 5];
  document.querySelectorAll('.day-pill[data-day]').forEach((pill) => {
    pill.classList.toggle('active', days.includes(parseInt(pill.dataset.day, 10)));
  });
}

function renderNetworkList() {
  const list = document.getElementById('network-list');
  if (!list) return;
  const networks = settings.trustedNetworks || [];
  list.innerHTML = networks.length === 0
    ? '<p style="font-size:12px;color:var(--text-muted);">No trusted networks added.</p>'
    : networks.map((name) => `
        <div class="network-item">
          <span>${escapeHtml(name)}</span>
          <button class="btn-remove-network" data-name="${escapeHtml(name)}" title="Remove">✕</button>
        </div>`).join('');

  list.querySelectorAll('.btn-remove-network').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      const updated = (settings.trustedNetworks || []).filter((n) => n !== name);
      await save({ trustedNetworks: updated });
      renderNetworkList();
    });
  });
}

function togglePasswordSettings(show) {
  const el = document.getElementById('password-settings');
  if (el) el.style.display = show ? '' : 'none';
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function attachListeners() {
  // Sidebar navigation
  document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.dataset.section);
    });
  });

  // ── Privacy ──
  bindToggle('opt-enabled', 'enabled');
  bindToggle('opt-hoverMode', 'hoverMode');
  bindToggle('opt-fakeChatMode', 'fakeChatMode');

  document.querySelectorAll('[data-key]').forEach((cb) => {
    cb.addEventListener('change', async (e) => {
      await save({ [cb.dataset.key]: e.target.checked });
    });
  });

  // ── Appearance ──
  document.querySelectorAll('.pill[data-preset]').forEach((pill) => {
    pill.addEventListener('click', async () => {
      const PRESETS = { low: 3, medium: 8, high: 16, extreme: 28, pixelated: 8 };
      const preset = pill.dataset.preset;
      const radius = PRESETS[preset] ?? settings.blurRadius;
      await save({ blurPreset: preset, blurRadius: radius });
      document.querySelectorAll('.pill[data-preset]').forEach((p) =>
        p.classList.toggle('active', p.dataset.preset === preset)
      );
      setVal('opt-blurRadius', radius);
      document.getElementById('blur-radius-val').textContent = `${radius}px`;
    });
  });

  document.getElementById('opt-blurRadius')?.addEventListener('input', async (e) => {
    const radius = parseInt(e.target.value, 10);
    document.getElementById('blur-radius-val').textContent = `${radius}px`;
    await save({ blurRadius: radius, blurPreset: 'custom' });
    document.querySelectorAll('.pill[data-preset]').forEach((p) => p.classList.remove('active'));
  });

  bindSelect('opt-theme', 'theme');

  // ── Keyboard ──
  bindSelect('opt-holdKey', 'holdKey');
  bindSelect('opt-panicKey', 'panicKey');
  bindSelect('opt-panicCount', 'panicCount', (v) => parseInt(v, 10));

  // ── Automation ──
  bindToggle('opt-autoLockEnabled', 'autoLockEnabled');
  bindSelect('opt-autoLockTimeout', 'autoLockTimeout', (v) => parseInt(v, 10));
  bindToggle('opt-scheduleEnabled', 'scheduleEnabled');
  bindInput('opt-scheduleStart', 'scheduleStart');
  bindInput('opt-scheduleEnd', 'scheduleEnd');

  // Day pills
  document.querySelectorAll('.day-pill[data-day]').forEach((pill) => {
    pill.addEventListener('click', async () => {
      const day = parseInt(pill.dataset.day, 10);
      const days = [...(settings.scheduleDays || [1, 2, 3, 4, 5])];
      const idx = days.indexOf(day);
      if (idx === -1) days.push(day);
      else days.splice(idx, 1);
      days.sort();
      await save({ scheduleDays: days });
      renderDayPills();
    });
  });

  // Add network
  document.getElementById('btn-add-network')?.addEventListener('click', async () => {
    const input = document.getElementById('new-network-name');
    const name = input?.value.trim();
    if (!name) return;
    const networks = [...(settings.trustedNetworks || [])];
    if (!networks.includes(name)) {
      networks.push(name);
      await save({ trustedNetworks: networks });
      renderNetworkList();
    }
    if (input) input.value = '';
  });

  // ── Security ──
  document.getElementById('opt-passwordEnabled')?.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await save({ passwordEnabled: enabled });
    togglePasswordSettings(enabled);
  });

  document.getElementById('btn-set-password')?.addEventListener('click', async () => {
    const pw = document.getElementById('new-password')?.value || '';
    const confirm = document.getElementById('confirm-password')?.value || '';
    const mismatch = document.getElementById('password-mismatch');
    const success = document.getElementById('password-success');
    if (mismatch) mismatch.style.display = 'none';
    if (success) success.style.display = 'none';

    if (!pw || pw !== confirm) {
      if (mismatch) mismatch.style.display = '';
      return;
    }
    const hash = await hashPassword(pw);
    await save({ passwordHash: hash });
    if (success) success.style.display = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
  });

  bindSelect('opt-unlockDuration', 'unlockDuration', (v) => parseInt(v, 10));

  // ── Data & Backup ──
  document.getElementById('btn-export')?.addEventListener('click', async () => {
    const json = await exportSettings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wps-settings-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    const status = document.getElementById('export-status');
    if (status) { status.textContent = '✅ Settings exported successfully'; setTimeout(() => { status.textContent = ''; }, 3000); }
  });

  document.getElementById('btn-import')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
  });

  document.getElementById('import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importSettings(text);
      settings = await getSettings();
      renderAll();
      showToast('Settings imported successfully');
    } catch (err) {
      showToast('Import failed: ' + err.message, true);
    }
    e.target.value = '';
  });

  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) return;
    await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', updates: {} });
    await resetSettings();
    settings = await getSettings();
    renderAll();
    showToast('Settings reset to defaults');
  });
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function navigate(sectionId) {
  document.querySelectorAll('.settings-section').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
  document.getElementById(sectionId)?.classList.add('active');
  document.querySelector(`.nav-link[data-section="${sectionId}"]`)?.classList.add('active');
}

// ─── Save toast ───────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, isError = false) {
  const toast = document.getElementById('save-toast');
  if (!toast) return;
  toast.textContent = (isError ? '⚠️ ' : '✅ ') + msg;
  toast.style.color = isError ? 'var(--danger)' : 'var(--accent)';
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getSettings() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  return res?.settings || {};
}

async function save(updates) {
  settings = { ...settings, ...updates };
  await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', updates });
  showToast('Saved');
}

function setCheck(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function bindToggle(id, key) {
  document.getElementById(id)?.addEventListener('change', async (e) => {
    await save({ [key]: e.target.checked });
  });
}

function bindSelect(id, key, transform = (v) => v) {
  document.getElementById(id)?.addEventListener('change', async (e) => {
    await save({ [key]: transform(e.target.value) });
  });
}

function bindInput(id, key) {
  document.getElementById(id)?.addEventListener('change', async (e) => {
    await save({ [key]: e.target.value });
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
