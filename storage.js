/**
 * storage.js — Centralized Chrome Storage API wrapper
 * All settings are stored locally; nothing is ever sent to a server.
 */

/** Default extension settings */
export const DEFAULT_SETTINGS = {
  // Core state
  enabled: true,
  locked: false,
  presentationMode: false,
  hoverMode: true,
  fakeChatMode: false,

  // Blur settings
  blurRadius: 8,           // pixels
  blurPreset: 'medium',   // 'low'|'medium'|'high'|'extreme'|'pixelated'|'custom'

  // Smart blur toggles
  blurAvatars: true,
  blurNames: true,
  blurMessages: true,
  blurImages: true,
  blurEmojis: false,
  blurStickers: true,
  blurVideos: true,
  blurVoiceNotes: true,
  blurLinks: true,
  blurLastSeen: true,
  blurAbout: true,
  blurChatPreview: true,
  blurNotificationBadges: true,

  // Hold-to-reveal key
  holdKey: 'Control',

  // Password unlock
  passwordEnabled: false,
  passwordHash: '',        // SHA-256 hash stored; never plaintext
  unlockDuration: 30,      // seconds

  // Auto-lock
  autoLockEnabled: true,
  autoLockTimeout: 60,     // seconds

  // Panic shortcut (triple ESC counted in content script)
  panicKey: 'Escape',
  panicCount: 3,

  // Temporary reveal
  tempRevealDuration: 30,  // seconds

  // Presentation mode extras
  fakeChatMessages: [
    'Hello!',
    'Meeting at 3 PM',
    'Thanks!',
    'See you tomorrow',
    'On my way',
    'Let me check and get back to you',
    'Sounds good 👍',
    'Can we reschedule?',
    'Done!',
    'Talk later',
  ],

  // Schedule mode
  scheduleEnabled: false,
  scheduleStart: '09:00',
  scheduleEnd: '18:00',
  scheduleDays: [1, 2, 3, 4, 5], // Mon–Fri

  // Trusted networks (SSIDs — Chrome API doesn't expose this; stored for UI only)
  trustedNetworks: [],

  // Theme
  theme: 'system', // 'light'|'dark'|'system'

  // Keyboard shortcut overrides (display only — Chrome manages actual commands)
  shortcutToggleBlur: 'Ctrl+Shift+B',
  shortcutPresentation: 'Ctrl+Shift+P',
  shortcutHoverMode: 'Ctrl+Shift+H',
  shortcutLock: 'Ctrl+Shift+L',
};

/**
 * Get all settings from storage, merged with defaults.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (result) => {
      resolve(result);
    });
  });
}

/**
 * Get a specific setting value.
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function getSetting(key) {
  const settings = await getSettings();
  return settings[key];
}

/**
 * Save one or more settings.
 * @param {Partial<typeof DEFAULT_SETTINGS>} updates
 * @returns {Promise<void>}
 */
export async function saveSettings(updates) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(updates, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Reset all settings to defaults.
 * @returns {Promise<void>}
 */
export async function resetSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        chrome.storage.local.set(DEFAULT_SETTINGS, () => resolve());
      }
    });
  });
}

/**
 * Export settings as a JSON string for backup.
 * @returns {Promise<string>}
 */
export async function exportSettings() {
  const settings = await getSettings();
  return JSON.stringify(settings, null, 2);
}

/**
 * Import settings from a JSON string.
 * @param {string} json
 * @returns {Promise<void>}
 */
export async function importSettings(json) {
  const parsed = JSON.parse(json);
  // Validate: only accept known keys
  const safe = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (key in parsed) safe[key] = parsed[key];
  }
  return saveSettings(safe);
}

/**
 * Hash a password using SHA-256.
 * @param {string} password
 * @returns {Promise<string>} hex digest
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a password against the stored hash.
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password) {
  const { passwordHash } = await getSettings();
  if (!passwordHash) return true; // no password set
  const hash = await hashPassword(password);
  return hash === passwordHash;
}
