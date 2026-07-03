/**
 * content-bundle.js — Single-file content script for WhatsApp Privacy Shield.
 * MV3 content scripts cannot use ES module imports, so all logic is inlined here.
 * 100% local — no data ever leaves the browser.
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // BLUR ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  /** CSS selectors for elements we blur, grouped by smart-blur toggle key */
  var BLUR_TARGETS = {
    blurAvatars: [
      // CDN profile pictures (most reliable — served from WhatsApp servers)
      'img[src*="pps.whatsapp.net"]',
      // WhatsApp testid-based avatar selectors
      '[data-testid="avatar-photo"]',
      '[data-testid="avatar"] img',
      '[data-testid="default-user"]',
      '[data-testid="group-subject"] img',
      // Fallback: blob-URL avatars loaded locally
      '[data-testid="chat-list-item-container"] img',
      '[data-testid="cell-frame-container"] img',
      '[data-testid="conversation-info-header"] img',
      // WhatsApp internal avatar wrapper class (catches remaining cases)
      '._aigt',
      '._aigi',
    ],
    blurNames: [
      '[data-testid="cell-frame-title"]',
      '[data-testid="conversation-info-header-chat-title"]',
      '[data-testid="chat-title"]',
      '[data-testid="contact-info-subtitle"]',
      '[data-testid="msg-container"] [data-testid="author"]',
      'span[title][dir="auto"]',
    ],
    blurMessages: [
      '[data-testid="msg-container"]',
      '.copyable-text',
      'span.selectable-text',
    ],
    blurImages: [
      '[data-testid="media-url-provider"] img',
      '[data-testid="image-thumb"] img',
      'img[src*="blob:"]',
      '[data-testid="msg-container"] img',
    ],
    blurEmojis: [
      'img.emoji',
      'span[data-emoji]',
    ],
    blurStickers: [
      '[data-testid="sticker"]',
      '[data-testid="msg-container"] canvas',
    ],
    blurVideos: [
      '[data-testid="msg-container"] video',
      '[data-testid="video-thumb"]',
    ],
    blurVoiceNotes: [
      '[data-testid="audio-player"]',
      '[data-testid="ptt-viewer"]',
    ],
    blurLinks: [
      '[data-testid="link-preview"]',
      '[data-testid="url-preview"]',
    ],
    blurLastSeen: [
      '[data-testid="status"]',
      '[data-testid="last-seen"]',
      '[data-testid="subtitle"]',
    ],
    blurAbout: [
      '[data-testid="about-content"]',
    ],
    blurChatPreview: [
      '[data-testid="last-msg"]',
      '[data-testid="cell-frame-secondary"]',
    ],
  };

  var BADGE_SELECTORS = [
    '[data-testid="icon-unread-count"]',
    'span[aria-label*="unread"]',
  ];

  var NEVER_BLUR = [
    '[data-testid="search"]',
    '[data-testid="menu"]',
    'button',
    'input',
    '[role="navigation"]',
    '[data-testid="side-header"]',
    '#wps-status-bar',
    '#wps-presentation-overlay',
    '.wps-eye-btn',
  ];

  var BLUR_PRESETS = { low: 3, medium: 8, high: 16, extreme: 28, pixelated: 8 };

  function isProtected(el) {
    for (var i = 0; i < NEVER_BLUR.length; i++) {
      try {
        if (el.matches(NEVER_BLUR[i]) || el.closest(NEVER_BLUR[i])) return true;
      } catch (e) { /* ignore */ }
    }
    return false;
  }

  function getBlurClass(s) {
    return s.blurPreset === 'pixelated' ? 'wps-blur-pixelated' : 'wps-blur';
  }

  function updateBlurRadiusVar(px) {
    document.documentElement.style.setProperty('--wps-blur', px + 'px');
  }

  function applyBlurAll(s) {
    var blurClass = getBlurClass(s);
    updateBlurRadiusVar(s.blurRadius || 8);

    var keys = Object.keys(BLUR_TARGETS);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var shouldBlur = s.enabled && s[key] !== false;
      var selectors = BLUR_TARGETS[key];
      for (var i = 0; i < selectors.length; i++) {
        try {
          var els = document.querySelectorAll(selectors[i]);
          for (var j = 0; j < els.length; j++) {
            var el = els[j];
            if (isProtected(el)) continue;
            if (shouldBlur) {
              el.classList.add(blurClass);
              if (s.hoverMode) {
                el.classList.add('wps-hover-reveal');
              } else {
                el.classList.remove('wps-hover-reveal');
              }
            } else {
              el.classList.remove('wps-blur', 'wps-blur-pixelated', 'wps-hover-reveal');
            }
          }
        } catch (e) { /* ignore bad selectors */ }
      }
    }

    // Notification badges
    var badgeSel = BADGE_SELECTORS.join(',');
    try {
      var badges = document.querySelectorAll(badgeSel);
      for (var b = 0; b < badges.length; b++) {
        if (s.blurNotificationBadges) {
          badges[b].classList.add('wps-badge-dot');
        } else {
          badges[b].classList.remove('wps-badge-dot');
        }
      }
    } catch (e) { /* ignore */ }
  }

  function removeAllBlur() {
    document.querySelectorAll('.wps-blur, .wps-blur-pixelated').forEach(function (el) {
      el.classList.remove('wps-blur', 'wps-blur-pixelated', 'wps-hover-reveal');
    });
    document.querySelectorAll('.wps-badge-dot').forEach(function (el) {
      el.classList.remove('wps-badge-dot');
    });
    document.body && document.body.classList.remove('wps-revealed');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTATION OBSERVER
  // ═══════════════════════════════════════════════════════════════════════════

  var _observer = null;
  var _observerSettings = null;
  var _debounceTimer = null;

  function startObserver(s) {
    _observerSettings = s;
    if (_observer) return;
    _observer = new MutationObserver(function (mutations) {
      if (!_observerSettings || !_observerSettings.enabled) return;
      var hasNew = false;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes.length > 0) {
          for (var j = 0; j < mutations[i].addedNodes.length; j++) {
            var node = mutations[i].addedNodes[j];
            if (node.nodeType === 1) {
              var id = node.id || '';
              var cls = (typeof node.className === 'string' ? node.className : '') || '';
              if (!id.startsWith('wps-') && !cls.includes('wps-')) {
                hasNew = true; break;
              }
            }
          }
          if (hasNew) break;
        }
      }
      if (!hasNew) return;
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(function () {
        applyBlurAll(_observerSettings);
        injectEyeButtons(_observerSettings);
      }, 80);
    });
    _observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (_observer) { _observer.disconnect(); _observer = null; }
  }

  function updateObserverSettings(s) { _observerSettings = s; }

  // ═══════════════════════════════════════════════════════════════════════════
  // REVEAL (eye buttons, timed reveal, full reveal)
  // ═══════════════════════════════════════════════════════════════════════════

  var _revealSettings = null;
  var _revealedChats = new Set();

  function updateRevealSettings(s) { _revealSettings = s; }

  function injectEyeButtons(s) {
    _revealSettings = s;
    if (!s.enabled) return;
    var rows = document.querySelectorAll(
      '[data-testid="cell-frame-container"], [role="listitem"][data-id]'
    );
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.querySelector('.wps-eye-btn')) continue;
      if (getComputedStyle(row).position === 'static') row.style.position = 'relative';
      var btn = createEyeButton();
      (function (r, b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          toggleChatReveal(r, b);
        });
      })(row, btn);
      row.appendChild(btn);
    }
  }

  function removeAllEyeButtons() {
    document.querySelectorAll('.wps-eye-btn').forEach(function (b) { b.remove(); });
    _revealedChats.clear();
  }

  function toggleChatReveal(row, btn) {
    if (_revealedChats.has(row)) {
      _revealedChats.delete(row);
      row.querySelectorAll('.wps-chat-revealed').forEach(function (el) {
        el.classList.remove('wps-chat-revealed');
      });
      btn.classList.remove('wps-eye-open');
      btn.title = 'Reveal this chat';
      applyBlurAll(_revealSettings);
    } else {
      _revealedChats.add(row);
      row.querySelectorAll('.wps-blur, .wps-blur-pixelated').forEach(function (el) {
        el.classList.add('wps-chat-revealed');
      });
      btn.classList.add('wps-eye-open');
      btn.title = 'Hide this chat';
    }
  }

  function createEyeButton() {
    var btn = document.createElement('button');
    btn.className = 'wps-eye-btn';
    btn.title = 'Reveal this chat';
    btn.setAttribute('aria-label', 'Toggle privacy for this chat');
    btn.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    return btn;
  }

  var _timedRevealHandle = null;

  function startTimedReveal(seconds, onTick, onDone) {
    removeAllBlur();
    document.body.classList.add('wps-revealed');
    var remaining = seconds;
    onTick && onTick(remaining);
    var interval = setInterval(function () {
      remaining -= 1;
      onTick && onTick(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        document.body.classList.remove('wps-revealed');
        if (_revealSettings) applyBlurAll(_revealSettings);
        onDone && onDone();
      }
    }, 1000);
    return {
      cancel: function () {
        clearInterval(interval);
        document.body.classList.remove('wps-revealed');
        if (_revealSettings) applyBlurAll(_revealSettings);
      }
    };
  }

  function setFullReveal(active, s) {
    if (active) {
      document.body.classList.add('wps-revealed');
    } else {
      document.body.classList.remove('wps-revealed');
      applyBlurAll(s);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD COMMANDS & PANIC
  // ═══════════════════════════════════════════════════════════════════════════

  var _cmdSettings = null;
  var _holdKeyActive = false;
  var _panicSequence = [];
  var _panicTimer = null;
  var _autoLockTimer = null;
  var _onPanic = null;

  function initCommands(s, onPanic, getSettings) {
    _cmdSettings = s;
    _onPanic = onPanic;

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('mousemove', resetAutoLock, { passive: true });
    document.addEventListener('click', resetAutoLock, { passive: true });
    resetAutoLock();
  }

  function updateCommandSettings(s) {
    _cmdSettings = s;
    resetAutoLock();
  }

  function handleKeyDown(e) {
    var s = _cmdSettings;
    if (!s) return;

    // Panic sequence
    var panicKey = s.panicKey || 'Escape';
    if (e.key === panicKey) {
      var now = Date.now();
      _panicSequence.push(now);
      _panicSequence = _panicSequence.filter(function (t) { return now - t < 1200; });
      var required = s.panicCount || 3;
      if (_panicSequence.length >= required) {
        _panicSequence = [];
        clearTimeout(_panicTimer);
        triggerPanic(s);
        return;
      }
      clearTimeout(_panicTimer);
      _panicTimer = setTimeout(function () { _panicSequence = []; }, 1200);
    }

    // Hold-to-reveal
    var holdKey = s.holdKey || 'Control';
    if (e.key === holdKey && !_holdKeyActive && s.enabled && !s.locked) {
      _holdKeyActive = true;
      setFullReveal(true, s);
    }
  }

  function handleKeyUp(e) {
    var s = _cmdSettings;
    if (!s) return;
    var holdKey = s.holdKey || 'Control';
    if (e.key === holdKey && _holdKeyActive) {
      _holdKeyActive = false;
      setFullReveal(false, s);
    }
  }

  function triggerPanic(s) {
    _holdKeyActive = false;
    document.body && document.body.classList.remove('wps-revealed');
    applyBlurAll(Object.assign({}, s, { enabled: true }));
    _onPanic && _onPanic();
  }

  function resetAutoLock() {
    var s = _cmdSettings;
    if (!s || !s.autoLockEnabled) return;
    clearTimeout(_autoLockTimer);
    var ms = (s.autoLockTimeout || 60) * 1000;
    _autoLockTimer = setTimeout(function () { triggerPanic(s); }, ms);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN CONTENT SCRIPT CONTROLLER
  // ═══════════════════════════════════════════════════════════════════════════

  var _settings = null;
  var _presentationOverlay = null;
  var _statusBar = null;
  var _displayCheckInterval = null;

  function boot(s) {
    _settings = s;

    // Expose control surface for background script injections
    window.__wps = {
      setEnabled: setEnabled,
      setPresentationMode: setPresentationMode,
      setHoverMode: setHoverMode,
      panic: panic,
      getSettings: function () { return _settings; },
    };

    applyBlurAll(_settings);
    startObserver(_settings);
    injectEyeButtons(_settings);
    initCommands(_settings, panic, function () { return _settings; });

    if (_settings.presentationMode) showPresentationOverlay();
    updateStatusBar();
    startDisplayCheck();
    listenForMessages();
    listenForStorageChanges();
  }

  // ── Core controls ───────────────────────────────────────────────────────────

  function setEnabled(enabled) {
    _settings = Object.assign({}, _settings, { enabled: enabled });
    if (enabled) {
      applyBlurAll(_settings);
      injectEyeButtons(_settings);
    } else {
      removeAllBlur();
      removeAllEyeButtons();
    }
    updateStatusBar();
  }

  function setPresentationMode(on) {
    _settings = Object.assign({}, _settings, { presentationMode: on, enabled: on ? true : _settings.enabled });
    if (on) { showPresentationOverlay(); applyBlurAll(_settings); }
    else { hidePresentationOverlay(); applyBlurAll(_settings); }
    updateStatusBar();
  }

  function setHoverMode(on) {
    _settings = Object.assign({}, _settings, { hoverMode: on });
    applyBlurAll(_settings);
  }

  function panic() {
    if (_timedRevealHandle) { _timedRevealHandle.cancel(); _timedRevealHandle = null; }
    hidePresentationOverlay();
    _settings = Object.assign({}, _settings, { enabled: true, locked: true });
    removeAllBlur();
    applyBlurAll(_settings);
    injectEyeButtons(_settings);
    hideStatusBar();
    saveToBackground({ enabled: true, locked: true });
  }

  // ── Presentation overlay ────────────────────────────────────────────────────

  function showPresentationOverlay() {
    if (_presentationOverlay) return;
    _presentationOverlay = document.createElement('div');
    _presentationOverlay.id = 'wps-presentation-overlay';
    _presentationOverlay.innerHTML = '<div class="wps-badge"><svg class="wps-shield-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.5C17.25 22.15 21 17.25 21 12V6L12 2Z" fill="rgba(255,255,255,0.15)" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><h1>Privacy Shield Active</h1><p>Screen sharing protection is enabled</p><button class="wps-exit-btn" id="wps-exit-presentation">Exit Presentation Mode</button></div>';
    document.body.appendChild(_presentationOverlay);
    document.getElementById('wps-exit-presentation') && document.getElementById('wps-exit-presentation').addEventListener('click', function () {
      setPresentationMode(false);
      saveToBackground({ presentationMode: false });
    });
  }

  function hidePresentationOverlay() {
    if (_presentationOverlay) { _presentationOverlay.remove(); _presentationOverlay = null; }
  }

  // ── Status bar ──────────────────────────────────────────────────────────────

  function updateStatusBar() {
    if (!_settings.enabled && !_settings.presentationMode) { hideStatusBar(); return; }
    if (!_statusBar) {
      _statusBar = document.createElement('div');
      _statusBar.id = 'wps-status-bar';
      document.body.appendChild(_statusBar);
    }
    var dot = _settings.enabled ? '<span class="wps-dot wps-active"></span>' : '<span class="wps-dot"></span>';
    var label = _settings.presentationMode ? '🛡️ Presentation Mode' : _settings.locked ? '🔒 Locked' : '🔒 Privacy Shield On';
    _statusBar.innerHTML = dot + ' ' + label;
  }

  function hideStatusBar() {
    if (_statusBar) { _statusBar.remove(); _statusBar = null; }
  }

  // ── Timed reveal ────────────────────────────────────────────────────────────

  function startTimed(seconds) {
    if (_timedRevealHandle) _timedRevealHandle.cancel();
    _revealSettings = _settings;
    _timedRevealHandle = startTimedReveal(seconds, function (remaining) {
      if (!_statusBar) {
        _statusBar = document.createElement('div');
        _statusBar.id = 'wps-status-bar';
        _statusBar.className = 'wps-clickable';
        document.body.appendChild(_statusBar);
      }
      _statusBar.innerHTML = '<span class="wps-dot"></span> Revealed — re-locking in ' + remaining + 's';
    }, function () {
      _timedRevealHandle = null;
      _settings = Object.assign({}, _settings, { enabled: true });
      updateStatusBar();
    });
  }

  // ── External display detection ──────────────────────────────────────────────

  function startDisplayCheck() {
    var lastExtended = window.screen && window.screen.isExtended;
    _displayCheckInterval = setInterval(function () {
      var nowExtended = window.screen && window.screen.isExtended;
      if (nowExtended && !lastExtended && !_settings.presentationMode) {
        setPresentationMode(true);
        saveToBackground({ presentationMode: true, enabled: true });
      }
      lastExtended = nowExtended;
    }, 3000);
  }

  // ── Settings sync ───────────────────────────────────────────────────────────

  function getSettingsFromBackground(cb) {
    try {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, function (response) {
        cb((response && response.settings) || {});
      });
    } catch (e) {
      cb({});
    }
  }

  function saveToBackground(updates) {
    _settings = Object.assign({}, _settings, updates);
    try {
      chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', updates: updates });
    } catch (e) { /* ignore */ }
  }

  function listenForMessages() {
    chrome.runtime.onMessage.addListener(function (message) {
      switch (message.type) {
        case 'SETTINGS_UPDATED':
          onSettingsUpdated(message.updates);
          break;
        case 'REBLUR':
          _settings = Object.assign({}, _settings, { enabled: true });
          applyBlurAll(_settings);
          injectEyeButtons(_settings);
          updateStatusBar();
          break;
        case 'UNBLUR':
          _settings = Object.assign({}, _settings, { enabled: false });
          removeAllBlur();
          updateStatusBar();
          break;
        case 'START_TIMED_REVEAL':
          startTimed(message.seconds);
          break;
      }
    });
  }

  function listenForStorageChanges() {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      var updates = {};
      var keys = Object.keys(changes);
      for (var i = 0; i < keys.length; i++) {
        updates[keys[i]] = changes[keys[i]].newValue;
      }
      onSettingsUpdated(updates);
    });
  }

  function onSettingsUpdated(updates) {
    var prev = Object.assign({}, _settings);
    _settings = Object.assign({}, _settings, updates);

    if ('blurRadius' in updates || 'blurPreset' in updates) {
      var preset = updates.blurPreset;
      var radius = (preset && BLUR_PRESETS[preset]) ? BLUR_PRESETS[preset] : (updates.blurRadius || _settings.blurRadius || 8);
      updateBlurRadiusVar(radius);
    }

    if ('presentationMode' in updates && updates.presentationMode !== prev.presentationMode) {
      updates.presentationMode ? showPresentationOverlay() : hidePresentationOverlay();
    }

    if (_settings.enabled) {
      applyBlurAll(_settings);
      injectEyeButtons(_settings);
    } else {
      removeAllBlur();
      removeAllEyeButtons();
    }

    updateCommandSettings(_settings);
    updateObserverSettings(_settings);
    updateRevealSettings(_settings);
    updateStatusBar();
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  getSettingsFromBackground(function (s) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { boot(s); }, { once: true });
    } else {
      boot(s);
    }
  });

})();
