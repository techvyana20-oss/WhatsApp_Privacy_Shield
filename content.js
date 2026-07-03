/**
 * content.js — Main content script injected into https://web.whatsapp.com
 * Orchestrates blur engine, mutation observer, keyboard commands, and reveal logic.
 * All processing is 100% local — no data leaves the browser.
 */

import { applyBlurAll, removeAllBlur, updateBlurRadiusVar, BLUR_PRESETS } from './blur.js';
import { startObserver, stopObserver, updateObserverSettings } from './observer.js';
import { injectEyeButtons, removeAllEyeButtons, startTimedReveal, setFullReveal } from './reveal.js';
import { initCommands, updateCommandSettings, destroyCommands } from './commands.js';

// ─── State ────────────────────────────────────────────────────────────────────

/** Live settings snapshot — kept in sync via chrome.storage.onChanged + messages */
let settings = null;

/** Active timed reveal handle */
let timedRevealHandle = null;

/** Presentation mode overlay element */
let presentationOverlay = null;

/** Status bar element */
let statusBar = null;

/** External display check interval */
let displayCheckInterval = null;

// ─── Boot ─────────────────────────────────────────────────────────────────────

(async function init() {
  // Load settings from storage
  settings = await getSettingsFromBackground();

  // Expose control surface for background scripting injections
  window.__wps = {
    setEnabled,
    setPresentationMode,
    setHoverMode,
    panic,
    getSettings: () => settings,
  };

  // Wait for WhatsApp to have at least a body
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

function boot() {
  applyBlurAll(settings);
  startObserver(settings);
  injectEyeButtons(settings);
  initCommands(settings, panic, () => settings);

  if (settings.presentationMode) {
    showPresentationOverlay();
  }

  updateStatusBar();
  startDisplayCheck();
  listenForMessages();
  listenForStorageChanges();
}

// ─── Core Controls ────────────────────────────────────────────────────────────

/**
 * Enable or disable the blur globally.
 * @param {boolean} enabled
 */
function setEnabled(enabled) {
  settings = { ...settings, enabled };
  if (enabled) {
    applyBlurAll(settings);
    injectEyeButtons(settings);
  } else {
    removeAllBlur();
    removeAllEyeButtons();
  }
  updateStatusBar();
}

/**
 * Toggle presentation mode.
 * @param {boolean} on
 */
function setPresentationMode(on) {
  settings = { ...settings, presentationMode: on, enabled: on ? true : settings.enabled };
  if (on) {
    showPresentationOverlay();
    applyBlurAll(settings);
  } else {
    hidePresentationOverlay();
    applyBlurAll(settings);
  }
  updateStatusBar();
}

/**
 * Toggle hover-to-reveal mode.
 * @param {boolean} on
 */
function setHoverMode(on) {
  settings = { ...settings, hoverMode: on };
  applyBlurAll(settings);
}

/**
 * Panic — instant blur everything, close any reveal, hide status.
 */
function panic() {
  timedRevealHandle?.cancel();
  timedRevealHandle = null;
  hidePresentationOverlay();
  settings = { ...settings, enabled: true, locked: true };
  removeAllBlur();
  applyBlurAll(settings);
  injectEyeButtons(settings);
  hideStatusBar();
  // Persist lock state
  saveSettingsToBackground({ enabled: true, locked: true });
}

// ─── Presentation Mode ────────────────────────────────────────────────────────

function showPresentationOverlay() {
  if (presentationOverlay) return;

  presentationOverlay = document.createElement('div');
  presentationOverlay.id = 'wps-presentation-overlay';
  presentationOverlay.innerHTML = `
    <div class="wps-badge">
      <svg class="wps-shield-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.5C17.25 22.15 21 17.25 21 12V6L12 2Z"
              fill="rgba(255,255,255,0.15)" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M9 12l2 2 4-4" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h1>Privacy Shield Active</h1>
      <p>Screen sharing protection is enabled</p>
      <button class="wps-exit-btn" id="wps-exit-presentation">Exit Presentation Mode</button>
    </div>`;

  document.body.appendChild(presentationOverlay);

  document.getElementById('wps-exit-presentation')?.addEventListener('click', () => {
    setPresentationMode(false);
    saveSettingsToBackground({ presentationMode: false });
  });
}

function hidePresentationOverlay() {
  presentationOverlay?.remove();
  presentationOverlay = null;
}

// ─── Status Bar ───────────────────────────────────────────────────────────────

function updateStatusBar() {
  if (!settings.enabled && !settings.presentationMode) {
    hideStatusBar();
    return;
  }

  if (!statusBar) {
    statusBar = document.createElement('div');
    statusBar.id = 'wps-status-bar';
    document.body.appendChild(statusBar);
  }

  const dot = settings.enabled ? '<span class="wps-dot wps-active"></span>' : '<span class="wps-dot"></span>';
  const label = settings.presentationMode
    ? '🛡️ Presentation Mode'
    : settings.locked
    ? '🔒 Locked'
    : '🔒 Privacy Shield On';

  statusBar.innerHTML = `${dot} ${label}`;
}

function hideStatusBar() {
  statusBar?.remove();
  statusBar = null;
}

// ─── Timed Reveal UI ─────────────────────────────────────────────────────────

/**
 * Start a timed reveal from a message request.
 * @param {number} seconds
 */
function startTimed(seconds) {
  timedRevealHandle?.cancel();

  timedRevealHandle = startTimedReveal(
    seconds,
    (remaining) => {
      if (!statusBar) {
        statusBar = document.createElement('div');
        statusBar.id = 'wps-status-bar';
        statusBar.className = 'wps-clickable';
        document.body.appendChild(statusBar);
      }
      statusBar.innerHTML = `<span class="wps-dot"></span> Revealed — re-locking in ${remaining}s (click to cancel)`;
      statusBar.onclick = () => {
        timedRevealHandle?.cancel();
        timedRevealHandle = null;
        saveSettingsToBackground({ enabled: true });
        updateStatusBar();
        chrome.runtime.sendMessage({ type: 'CANCEL_TIMED_REVEAL' });
      };
    },
    () => {
      timedRevealHandle = null;
      settings = { ...settings, enabled: true };
      updateStatusBar();
    }
  );
}

// ─── External Display Detection ───────────────────────────────────────────────

/**
 * Poll for screen count changes (secondary display / projector).
 * window.screen.isExtended is true when more than one display is connected.
 */
function startDisplayCheck() {
  let lastExtended = window.screen.isExtended;

  displayCheckInterval = setInterval(() => {
    const nowExtended = window.screen.isExtended;
    if (nowExtended && !lastExtended) {
      // New display connected — enable presentation mode automatically
      if (!settings.presentationMode) {
        setPresentationMode(true);
        saveSettingsToBackground({ presentationMode: true, enabled: true });
        chrome.runtime.sendMessage({
          type: 'SAVE_SETTINGS',
          updates: { presentationMode: true, enabled: true },
        }).catch(() => {});
      }
    }
    lastExtended = nowExtended;
  }, 3000);
}

// ─── Settings Sync ────────────────────────────────────────────────────────────

/**
 * Fetch current settings from the background service worker.
 * @returns {Promise<object>}
 */
async function getSettingsFromBackground() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    return response?.settings || {};
  } catch {
    return {};
  }
}

/**
 * Persist settings via background.
 * @param {object} updates
 */
function saveSettingsToBackground(updates) {
  settings = { ...settings, ...updates };
  chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', updates }).catch(() => {});
}

/**
 * Listen for messages from background / popup.
 */
function listenForMessages() {
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'SETTINGS_UPDATED':
        onSettingsUpdated(message.updates);
        break;
      case 'REBLUR':
        settings = { ...settings, enabled: true };
        applyBlurAll(settings);
        injectEyeButtons(settings);
        updateStatusBar();
        break;
      case 'UNBLUR':
        settings = { ...settings, enabled: false };
        removeAllBlur();
        updateStatusBar();
        break;
      case 'START_TIMED_REVEAL':
        startTimed(message.seconds);
        break;
    }
  });
}

/**
 * React to storage changes in real-time (updated from popup or options page).
 */
function listenForStorageChanges() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const updates = {};
    for (const [key, { newValue }] of Object.entries(changes)) {
      updates[key] = newValue;
    }
    onSettingsUpdated(updates);
  });
}

/**
 * Apply a partial settings update.
 * @param {object} updates
 */
function onSettingsUpdated(updates) {
  const prev = { ...settings };
  settings = { ...settings, ...updates };

  // Sync blur radius CSS var if changed
  if ('blurRadius' in updates || 'blurPreset' in updates) {
    const radius =
      updates.blurPreset && BLUR_PRESETS[updates.blurPreset]
        ? BLUR_PRESETS[updates.blurPreset]
        : updates.blurRadius ?? settings.blurRadius;
    updateBlurRadiusVar(radius);
  }

  // Presentation mode toggled
  if ('presentationMode' in updates && updates.presentationMode !== prev.presentationMode) {
    if (updates.presentationMode) {
      showPresentationOverlay();
    } else {
      hidePresentationOverlay();
    }
  }

  // Re-apply blur state
  if (settings.enabled) {
    applyBlurAll(settings);
    injectEyeButtons(settings);
  } else {
    removeAllBlur();
    removeAllEyeButtons();
  }

  // Sync commands module
  updateCommandSettings(settings);
  updateObserverSettings(settings);
  updateStatusBar();
}
