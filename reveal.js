/**
 * reveal.js — Selective reveal: eye icon per chat row, chat-level unblur.
 */

import { applyBlurAll, removeAllBlur } from './blur.js';

let _settings = null;
const REVEALED_CHATS = new Set(); // set of chat row elements that are individually revealed

/**
 * Update the settings reference.
 * @param {object} settings
 */
export function updateRevealSettings(settings) {
  _settings = settings;
}

/**
 * Inject eye-icon buttons into every chat list row that doesn't already have one.
 * @param {object} settings
 */
export function injectEyeButtons(settings) {
  _settings = settings;
  if (!settings.enabled) return;

  // WhatsApp chat list rows
  const rows = document.querySelectorAll(
    '[data-testid="cell-frame-container"], [role="listitem"][data-id]'
  );

  rows.forEach((row) => {
    if (row.querySelector('.wps-eye-btn')) return; // already injected
    if (getComputedStyle(row).position === 'static') {
      row.style.position = 'relative';
    }

    const btn = createEyeButton();
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleChatReveal(row, btn);
    });
    row.appendChild(btn);
  });
}

/**
 * Remove all injected eye buttons.
 */
export function removeAllEyeButtons() {
  document.querySelectorAll('.wps-eye-btn').forEach((btn) => btn.remove());
  REVEALED_CHATS.clear();
}

/**
 * Toggle reveal for a specific chat row.
 * @param {Element} row
 * @param {Element} btn
 */
function toggleChatReveal(row, btn) {
  if (REVEALED_CHATS.has(row)) {
    // Re-blur this chat
    REVEALED_CHATS.delete(row);
    row.querySelectorAll('.wps-chat-revealed').forEach((el) => {
      el.classList.remove('wps-chat-revealed');
    });
    btn.classList.remove('wps-eye-open');
    btn.title = 'Reveal this chat';
    // Re-apply blur
    row.querySelectorAll('[class*="wps-blur"]').forEach((el) => {
      el.classList.add(_settings?.blurPreset === 'pixelated' ? 'wps-blur-pixelated' : 'wps-blur');
    });
    applyBlurAll(_settings);
  } else {
    // Reveal this chat only
    REVEALED_CHATS.add(row);
    row.querySelectorAll('.wps-blur, .wps-blur-pixelated').forEach((el) => {
      el.classList.add('wps-chat-revealed');
    });
    btn.classList.add('wps-eye-open');
    btn.title = 'Hide this chat';
  }
}

/**
 * Build the SVG eye icon button element.
 * @returns {HTMLButtonElement}
 */
function createEyeButton() {
  const btn = document.createElement('button');
  btn.className = 'wps-eye-btn';
  btn.title = 'Reveal this chat';
  btn.setAttribute('aria-label', 'Toggle privacy for this chat');
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`;
  return btn;
}

/**
 * Temporarily reveal everything for a set number of seconds.
 * @param {number} seconds
 * @param {Function} onTick — called each second with remaining seconds
 * @param {Function} onDone — called when timer expires
 * @returns {{ cancel: Function }} cancel handle
 */
export function startTimedReveal(seconds, onTick, onDone) {
  removeAllBlur();
  document.body.classList.add('wps-revealed');

  let remaining = seconds;
  onTick?.(remaining);

  const interval = setInterval(() => {
    remaining -= 1;
    onTick?.(remaining);
    if (remaining <= 0) {
      clearInterval(interval);
      endTimedReveal();
      onDone?.();
    }
  }, 1000);

  function cancel() {
    clearInterval(interval);
    endTimedReveal();
  }

  return { cancel };
}

function endTimedReveal() {
  document.body.classList.remove('wps-revealed');
  if (_settings) applyBlurAll(_settings);
}

/**
 * Full reveal (hold-key mode) — removes blur class while key is held.
 * @param {boolean} active
 * @param {object} settings
 */
export function setFullReveal(active, settings) {
  if (active) {
    document.body.classList.add('wps-revealed');
  } else {
    document.body.classList.remove('wps-revealed');
    applyBlurAll(settings);
  }
}
