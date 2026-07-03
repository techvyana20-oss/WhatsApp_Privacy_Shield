/**
 * blur.js — Blur engine: applies/removes blur classes on WhatsApp Web elements.
 * Uses resilient attribute/role-based selectors + class heuristics.
 * Avoids hard-coded WhatsApp internal class names where possible.
 */

/** CSS selectors for elements we want to blur, grouped by feature toggle key */
export const BLUR_TARGETS = {
  // Contact names / group names in the chat list and headers
  blurNames: [
    '[data-testid="cell-frame-title"]',
    '[data-testid="conversation-info-header-chat-title"]',
    '[data-testid="chat-title"]',
    '[data-testid="contact-info-subtitle"]',
    '[data-testid="msg-container"] [data-testid="author"]',
    'span[title][dir="auto"]',              // Most names use title + dir="auto"
    '.wps-selector-name',
  ],

  // Message bubbles (text content)
  blurMessages: [
    '[data-testid="msg-container"]',
    '[data-testid="conversation-compose-box-input"]',
    '[data-testid="last-msg-status"]',
    '.copyable-text',
    'span.selectable-text',
  ],

  // Images
  blurImages: [
    '[data-testid="media-url-provider"] img',
    '[data-testid="image-thumb"] img',
    'img[src*="blob:"]',
    '[data-testid="msg-container"] img',
  ],

  // Emojis
  blurEmojis: [
    'img.emoji',
    '[data-testid="msg-container"] img[alt]',
    'span[data-emoji]',
  ],

  // Stickers
  blurStickers: [
    '[data-testid="sticker"]',
    '[data-testid="msg-container"] canvas',
  ],

  // Videos
  blurVideos: [
    '[data-testid="msg-container"] video',
    'video',
    '[data-testid="video-thumb"]',
  ],

  // Voice notes
  blurVoiceNotes: [
    '[data-testid="audio-player"]',
    '[data-testid="ptt-viewer"]',
  ],

  // Links / link previews
  blurLinks: [
    '[data-testid="link-preview"]',
    '[data-testid="url-preview"]',
    'a[href]',
  ],

  // Last seen / online status
  blurLastSeen: [
    '[data-testid="status"]',
    '[data-testid="last-seen"]',
    '[data-testid="subtitle"]',
  ],

  // About / bio
  blurAbout: [
    '[data-testid="about-content"]',
  ],

  // Chat list preview (last message snippet in sidebar)
  blurChatPreview: [
    '[data-testid="last-msg"]',
    '[data-testid="cell-frame-secondary"]',
    '[data-testid="last-msg-status"]',
  ],
};

/** Elements we must NEVER blur (controls, navigation, settings) */
export const NEVER_BLUR_SELECTORS = [
  '[data-testid="search"]',
  '[data-testid="menu"]',
  '[data-testid="settings"]',
  '[data-testid="new-chat-btn"]',
  'button',
  'input',
  '[role="navigation"]',
  '[data-testid="side-header"]',
  '#wps-status-bar',
  '#wps-presentation-overlay',
  '.wps-eye-btn',
];

/** Notification badge selectors */
export const BADGE_SELECTORS = [
  '[data-testid="icon-unread-count"]',
  'span[aria-label*="unread"]',
  '.wps-badge',
];

/**
 * Apply or remove blur on a single element.
 * @param {Element} el
 * @param {string} blurClass — 'wps-blur' or 'wps-blur-pixelated'
 * @param {boolean} shouldBlur
 * @param {boolean} hoverMode
 */
export function applyBlurToElement(el, blurClass, shouldBlur, hoverMode) {
  if (!el || isProtected(el)) return;

  if (shouldBlur) {
    el.classList.add(blurClass);
    if (hoverMode) {
      el.classList.add('wps-hover-reveal');
    } else {
      el.classList.remove('wps-hover-reveal');
    }
  } else {
    el.classList.remove(blurClass, 'wps-blur', 'wps-blur-pixelated', 'wps-hover-reveal');
  }
}

/**
 * Apply blur to all matching elements based on settings.
 * @param {object} settings
 */
export function applyBlurAll(settings) {
  const blurClass = getBlurClass(settings);
  updateBlurRadiusVar(settings.blurRadius);

  for (const [key, selectors] of Object.entries(BLUR_TARGETS)) {
    const shouldBlur = settings.enabled && settings[key] !== false;
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (!isProtected(el)) {
            applyBlurToElement(el, blurClass, shouldBlur, settings.hoverMode);
          }
        });
      } catch {
        // Selector may be invalid — ignore
      }
    }
  }

  // Notification badges
  if (settings.blurNotificationBadges) {
    document.querySelectorAll(BADGE_SELECTORS.join(',')).forEach((el) => {
      el.classList.add('wps-badge-dot');
    });
  } else {
    document.querySelectorAll('.wps-badge-dot').forEach((el) => {
      el.classList.remove('wps-badge-dot');
    });
  }
}

/**
 * Remove all blur from the entire document.
 */
export function removeAllBlur() {
  document.querySelectorAll('.wps-blur, .wps-blur-pixelated').forEach((el) => {
    el.classList.remove('wps-blur', 'wps-blur-pixelated', 'wps-hover-reveal');
  });
  document.querySelectorAll('.wps-badge-dot').forEach((el) => {
    el.classList.remove('wps-badge-dot');
  });
  document.body?.classList.remove('wps-revealed');
}

/**
 * Determine which CSS blur class to apply based on settings.
 * @param {object} settings
 * @returns {string}
 */
export function getBlurClass(settings) {
  if (settings.blurPreset === 'pixelated') return 'wps-blur-pixelated';
  return 'wps-blur';
}

/**
 * Update the CSS custom property for blur radius.
 * @param {number} px
 */
export function updateBlurRadiusVar(px) {
  document.documentElement.style.setProperty('--wps-blur', `${px}px`);
}

/**
 * Preset blur radii mapped to preset names.
 */
export const BLUR_PRESETS = {
  low: 3,
  medium: 8,
  high: 16,
  extreme: 28,
  pixelated: 8, // handled via SVG filter
};

/**
 * Check if an element is protected from blurring.
 * @param {Element} el
 * @returns {boolean}
 */
function isProtected(el) {
  for (const selector of NEVER_BLUR_SELECTORS) {
    try {
      if (el.matches(selector) || el.closest(selector)) return true;
    } catch {
      // ignore
    }
  }
  return false;
}
