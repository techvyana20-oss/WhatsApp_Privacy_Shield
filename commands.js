/**
 * commands.js — Keyboard shortcut & panic handler (runs inside content script context).
 * Handles:
 *  - Hold key (default: Ctrl) → temporary full reveal
 *  - Triple ESC → panic (instant re-blur)
 *  - Auto-lock on inactivity
 */

import { setFullReveal } from './reveal.js';
import { applyBlurAll } from './blur.js';

let _settings = null;
let _holdKeyActive = false;
let _panicSequence = [];
let _panicTimer = null;
let _autoLockTimer = null;
let _onPanic = null;
let _onSettingsNeeded = null;

/**
 * Initialise the command handler.
 * @param {object} settings
 * @param {Function} onPanic — called when panic is triggered
 * @param {Function} onSettingsNeeded — called to get latest settings
 */
export function initCommands(settings, onPanic, onSettingsNeeded) {
  _settings = settings;
  _onPanic = onPanic;
  _onSettingsNeeded = onSettingsNeeded;

  document.addEventListener('keydown', handleKeyDown, { capture: true });
  document.addEventListener('keyup', handleKeyUp, { capture: true });
  document.addEventListener('mousemove', resetAutoLock, { passive: true });
  document.addEventListener('click', resetAutoLock, { passive: true });
  document.addEventListener('keydown', resetAutoLock, { passive: true });

  resetAutoLock();
}

/**
 * Update the settings used by the command handler.
 * @param {object} settings
 */
export function updateCommandSettings(settings) {
  _settings = settings;
  resetAutoLock();
}

/**
 * Tear down all listeners.
 */
export function destroyCommands() {
  document.removeEventListener('keydown', handleKeyDown, { capture: true });
  document.removeEventListener('keyup', handleKeyUp, { capture: true });
  document.removeEventListener('mousemove', resetAutoLock, { passive: true });
  document.removeEventListener('click', resetAutoLock, { passive: true });
  clearTimeout(_autoLockTimer);
  clearTimeout(_panicTimer);
}

// ── Key Down ──────────────────────────────────────────────────────────────────

function handleKeyDown(e) {
  const settings = _onSettingsNeeded?.() || _settings;
  if (!settings) return;

  // ── Panic sequence (triple ESC) ───────────────────────────────────────────
  const panicKey = settings.panicKey || 'Escape';
  if (e.key === panicKey) {
    _panicSequence.push(Date.now());
    // Keep only recent presses (within 1.2 seconds)
    _panicSequence = _panicSequence.filter((t) => Date.now() - t < 1200);

    const requiredCount = settings.panicCount || 3;
    if (_panicSequence.length >= requiredCount) {
      _panicSequence = [];
      clearTimeout(_panicTimer);
      triggerPanic(settings);
      return;
    }

    clearTimeout(_panicTimer);
    _panicTimer = setTimeout(() => { _panicSequence = []; }, 1200);
  }

  // ── Hold-to-reveal key ────────────────────────────────────────────────────
  const holdKey = settings.holdKey || 'Control';
  if (e.key === holdKey && !_holdKeyActive && settings.enabled && !settings.locked) {
    _holdKeyActive = true;
    setFullReveal(true, settings);
  }
}

// ── Key Up ────────────────────────────────────────────────────────────────────

function handleKeyUp(e) {
  const settings = _onSettingsNeeded?.() || _settings;
  if (!settings) return;

  const holdKey = settings.holdKey || 'Control';
  if (e.key === holdKey && _holdKeyActive) {
    _holdKeyActive = false;
    setFullReveal(false, settings);
  }
}

// ── Panic ─────────────────────────────────────────────────────────────────────

function triggerPanic(settings) {
  // Force blur everything immediately
  _holdKeyActive = false;
  document.body.classList.remove('wps-revealed');
  applyBlurAll({ ...settings, enabled: true });
  _onPanic?.();
}

// ── Auto-lock ─────────────────────────────────────────────────────────────────

function resetAutoLock() {
  const settings = _onSettingsNeeded?.() || _settings;
  if (!settings?.autoLockEnabled) return;

  clearTimeout(_autoLockTimer);
  const ms = (settings.autoLockTimeout || 60) * 1000;
  _autoLockTimer = setTimeout(() => {
    triggerPanic(settings);
  }, ms);
}
