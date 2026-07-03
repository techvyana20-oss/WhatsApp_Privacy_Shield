/**
 * popup.js — Popup controller.
 * Reads/writes settings via background service worker.
 * No data ever leaves the browser.
 */

// ─── State ────────────────────────────────────────────────────────────────────
let settings = null;
let countdownHandle = null;
let countdownSeconds = 0;

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  settings = await getSettings();
  renderAll();
  attachListeners();
});

// ─── Render ───────────────────────────────────────────────────────────────────
function renderAll() {
  renderStatusText();
  renderMainToggle();
  renderActionButtons();
  renderBlurControls();
  renderSmartBlur();
  renderPasswordSection();
}

function renderStatusText() {
  const el = document.getElementById('status-text');
  if (!el) return;
  if (settings.presentationMode) el.textContent = '🎥 Presentation Mode';
  else if (settings.locked) el.textContent = '🔒 Locked';
  else if (settings.enabled) el.textContent = '✅ Privacy active';
  else el.textContent = '⚪ Disabled';
}

function renderMainToggle() {
  const toggle = document.getElementById('toggle-enabled');
  if (toggle) toggle.checked = settings.enabled;
}

function renderActionButtons() {
  setActive('btn-presentation', settings.presentationMode);
  setActive('btn-hover-mode', settings.hoverMode);
  setActive('btn-fake-chat', settings.fakeChatMode);
}

function renderBlurControls() {
  // Preset pills
  document.querySelectorAll('.pill[data-preset]').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.preset === settings.blurPreset);
  });
  // Radius slider
  const slider = document.getElementById('blur-radius');
  if (slider) slider.value = settings.blurRadius;
}

function renderSmartBlur() {
  document.querySelectorAll('[data-key]').forEach((cb) => {
    cb.checked = settings[cb.dataset.key] !== false;
  });
}

function renderPasswordSection() {
  const section = document.getElementById('password-section');
  if (section) section.style.display = settings.passwordEnabled ? '' : 'none';
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function attachListeners() {
  // Main toggle
  document.getElementById('toggle-enabled')?.addEventListener('change', async (e) => {
    await save({ enabled: e.target.checked });
    renderStatusText();
  });

  // Settings page
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    window.close();
  });

  // Presentation mode
  document.getElementById('btn-presentation')?.addEventListener('click', async () => {
    const next = !settings.presentationMode;
    await save({ presentationMode: next, enabled: next ? true : settings.enabled });
    setActive('btn-presentation', next);
    renderStatusText();
  });

  // Hover mode
  document.getElementById('btn-hover-mode')?.addEventListener('click', async () => {
    const next = !settings.hoverMode;
    await save({ hoverMode: next });
    setActive('btn-hover-mode', next);
  });

  // Fake chat mode
  document.getElementById('btn-fake-chat')?.addEventListener('click', async () => {
    const next = !settings.fakeChatMode;
    await save({ fakeChatMode: next });
    setActive('btn-fake-chat', next);
  });

  // Panic
  document.getElementById('btn-panic')?.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'PANIC' });
    settings = { ...settings, enabled: true, locked: true };
    renderAll();
    // Brief visual feedback
    const btn = document.getElementById('btn-panic');
    if (btn) {
      btn.style.background = 'rgba(255,77,77,0.25)';
      setTimeout(() => { btn.style.background = ''; }, 500);
    }
  });

  // Temporary reveal
  document.getElementById('btn-temp-reveal')?.addEventListener('click', async () => {
    const seconds = parseInt(document.getElementById('temp-reveal-duration')?.value || '30', 10);
    await chrome.runtime.sendMessage({ type: 'START_TIMED_REVEAL', seconds });
    settings = { ...settings, enabled: false };
    startCountdownUI(seconds);
  });

  document.getElementById('btn-cancel-reveal')?.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CANCEL_TIMED_REVEAL' });
    stopCountdownUI();
    settings = { ...settings, enabled: true };
    renderStatusText();
  });

  // Blur presets
  document.querySelectorAll('.pill[data-preset]').forEach((pill) => {
    pill.addEventListener('click', async () => {
      const preset = pill.dataset.preset;
      const PRESETS = { low: 3, medium: 8, high: 16, extreme: 28, pixelated: 8 };
      const radius = PRESETS[preset] ?? 8;
      await save({ blurPreset: preset, blurRadius: radius });
      document.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      const slider = document.getElementById('blur-radius');
      if (slider) slider.value = radius;
    });
  });

  // Blur radius slider
  document.getElementById('blur-radius')?.addEventListener('input', async (e) => {
    const radius = parseInt(e.target.value, 10);
    await save({ blurRadius: radius, blurPreset: 'custom' });
    document.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
  });

  // Smart blur checkboxes
  document.querySelectorAll('[data-key]').forEach((cb) => {
    cb.addEventListener('change', async (e) => {
      await save({ [cb.dataset.key]: e.target.checked });
    });
  });

  // Password unlock
  document.getElementById('btn-unlock')?.addEventListener('click', async () => {
    const password = document.getElementById('password-input')?.value || '';
    const { ok } = await chrome.runtime.sendMessage({
      type: 'VERIFY_PASSWORD',
      password,
    }).catch(() => ({ ok: false }));

    if (ok) {
      const duration = settings.unlockDuration || 30;
      await save({ enabled: false, locked: false });
      document.getElementById('password-error').style.display = 'none';
      renderStatusText();
      // Auto re-lock after duration
      setTimeout(async () => {
        await save({ enabled: true, locked: true });
        renderStatusText();
      }, duration * 1000);
    } else {
      const errEl = document.getElementById('password-error');
      if (errEl) errEl.style.display = '';
    }
  });
}

// ─── Countdown UI ─────────────────────────────────────────────────────────────
function startCountdownUI(seconds) {
  countdownSeconds = seconds;
  const row = document.getElementById('temp-reveal-countdown');
  const sel = document.getElementById('temp-reveal-duration')?.parentElement;
  if (row) row.style.display = '';
  if (sel) sel.style.display = 'none';

  clearInterval(countdownHandle);
  countdownHandle = setInterval(() => {
    countdownSeconds -= 1;
    const el = document.getElementById('countdown-seconds');
    if (el) el.textContent = countdownSeconds;
    if (countdownSeconds <= 0) {
      stopCountdownUI();
      settings = { ...settings, enabled: true };
      renderStatusText();
    }
  }, 1000);
}

function stopCountdownUI() {
  clearInterval(countdownHandle);
  const row = document.getElementById('temp-reveal-countdown');
  const sel = document.getElementById('temp-reveal-duration')?.parentElement;
  if (row) row.style.display = 'none';
  if (sel) sel.style.display = '';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getSettings() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  return res?.settings || {};
}

async function save(updates) {
  settings = { ...settings, ...updates };
  await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', updates });
}

function setActive(id, active) {
  document.getElementById(id)?.classList.toggle('active', active);
}
