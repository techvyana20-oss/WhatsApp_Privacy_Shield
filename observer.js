/**
 * observer.js — MutationObserver that watches WhatsApp Web DOM changes.
 * Automatically blurs newly added elements (incoming messages, new chats, etc.)
 */

import { applyBlurAll } from './blur.js';
import { injectEyeButtons } from './reveal.js';

let _observer = null;
let _settings = null;
let _debounceTimer = null;

/**
 * Start observing the WhatsApp Web DOM for mutations.
 * @param {object} settings — current extension settings
 */
export function startObserver(settings) {
  _settings = settings;
  if (_observer) return; // already running

  _observer = new MutationObserver((mutations) => {
    onMutations(mutations);
  });

  _observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false,
  });
}

/**
 * Stop and disconnect the observer.
 */
export function stopObserver() {
  if (_observer) {
    _observer.disconnect();
    _observer = null;
  }
}

/**
 * Update the settings the observer uses when re-applying blur.
 * @param {object} settings
 */
export function updateObserverSettings(settings) {
  _settings = settings;
}

/**
 * Handle incoming mutations. Debounced to avoid thrashing on message storms.
 * @param {MutationRecord[]} mutations
 */
function onMutations(mutations) {
  if (!_settings?.enabled) return;

  // Check if there are any relevant added nodes
  let hasRelevantChanges = false;
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && !isIgnoredNode(node)) {
          hasRelevantChanges = true;
          break;
        }
      }
    }
    if (hasRelevantChanges) break;
  }

  if (!hasRelevantChanges) return;

  // Debounce: re-apply blur max once per 80ms
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    applyBlurAll(_settings);
    injectEyeButtons(_settings);
  }, 80);
}

/**
 * Skip nodes that are part of our own UI injections.
 * @param {Element} node
 * @returns {boolean}
 */
function isIgnoredNode(node) {
  if (!node.id && !node.className) return false;
  const id = node.id || '';
  const cls = (typeof node.className === 'string' ? node.className : '') || '';
  return id.startsWith('wps-') || cls.includes('wps-');
}
