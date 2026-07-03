/**
 * background.js — Service Worker (Manifest V3)
 * Handles alarms, context menus, notifications, and message routing.
 */

import { getSettings, saveSettings, DEFAULT_SETTINGS } from './storage.js';

// ─── Context Menu ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'wps-toggle-blur',
    title: 'Toggle Privacy Blur',
    contexts: ['page'],
    documentUrlPatterns: ['https://web.whatsapp.com/*'],
  });
  chrome.contextMenus.create({
    id: 'wps-presentation-mode',
    title: 'Toggle Presentation Mode',
    contexts: ['page'],
    documentUrlPatterns: ['https://web.whatsapp.com/*'],
  });
  chrome.contextMenus.create({
    id: 'wps-panic',
    title: '🛡️ Panic — Blur Everything Now',
    contexts: ['page'],
    documentUrlPatterns: ['https://web.whatsapp.com/*'],
  });
  chrome.contextMenus.create({
    id: 'separator1',
    type: 'separator',
    contexts: ['page'],
    documentUrlPatterns: ['https://web.whatsapp.com/*'],
  });
  chrome.contextMenus.create({
    id: 'wps-options',
    title: 'Privacy Shield Settings…',
    contexts: ['page'],
    documentUrlPatterns: ['https://web.whatsapp.com/*'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  switch (info.menuItemId) {
    case 'wps-toggle-blur':
      await toggleBlur(tab.id);
      break;
    case 'wps-presentation-mode':
      await togglePresentationMode(tab.id);
      break;
    case 'wps-panic':
      await panic(tab.id);
      break;
    case 'wps-options':
      chrome.runtime.openOptionsPage();
      break;
  }
});

// ─── Keyboard Commands ───────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://web.whatsapp.com')) return;

  switch (command) {
    case 'toggle-blur':
      await toggleBlur(tab.id);
      break;
    case 'presentation-mode':
      await togglePresentationMode(tab.id);
      break;
    case 'hover-mode':
      await toggleHoverMode(tab.id);
      break;
    case 'lock-now':
      await panic(tab.id);
      break;
  }
});

// ─── Alarms ──────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'wps-auto-reblur') {
    // Timed reveal expired — re-enable blur
    await saveSettings({ enabled: true, locked: true });
    await broadcastToWhatsApp({ type: 'REBLUR' });
    chrome.notifications.create('wps-reblur', {
      type: 'basic',
      iconUrl: 'assets/icons/icon48.png',
      title: 'WhatsApp Privacy Shield',
      message: 'Privacy mode re-activated automatically.',
      priority: 1,
    });
  }

  if (alarm.name === 'wps-schedule-check') {
    await checkSchedule();
  }
});

// Set a repeating alarm every minute for schedule checks
chrome.alarms.create('wps-schedule-check', { periodInMinutes: 1 });

// ─── Message Routing ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // keep channel open for async
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'GET_SETTINGS': {
        const settings = await getSettings();
        sendResponse({ ok: true, settings });
        break;
      }
      case 'SAVE_SETTINGS': {
        await saveSettings(message.updates);
        // Notify all WhatsApp tabs of updated settings
        await broadcastToWhatsApp({ type: 'SETTINGS_UPDATED', updates: message.updates });
        sendResponse({ ok: true });
        break;
      }
      case 'PANIC': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) await panic(tab.id);
        sendResponse({ ok: true });
        break;
      }
      case 'START_TIMED_REVEAL': {
        const { seconds } = message;
        await saveSettings({ enabled: false });
        chrome.alarms.create('wps-auto-reblur', { delayInMinutes: seconds / 60 });
        await broadcastToWhatsApp({ type: 'UNBLUR' });
        sendResponse({ ok: true });
        break;
      }
      case 'CANCEL_TIMED_REVEAL': {
        chrome.alarms.clear('wps-auto-reblur');
        await saveSettings({ enabled: true });
        await broadcastToWhatsApp({ type: 'REBLUR' });
        sendResponse({ ok: true });
        break;
      }
      case 'VERIFY_PASSWORD': {
        const { verifyPassword } = await import('./storage.js');
        const ok = await verifyPassword(message.password || '');
        sendResponse({ ok });
        break;
      }
      case 'OPEN_OPTIONS': {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
  } catch (err) {
    console.error('[WPS Background]', err);
    sendResponse({ ok: false, error: err.message });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function toggleBlur(tabId) {
  const { enabled } = await getSettings();
  const next = !enabled;
  await saveSettings({ enabled: next });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (enabled) => window.__wps?.setEnabled?.(enabled),
    args: [next],
  });
}

async function togglePresentationMode(tabId) {
  const { presentationMode, enabled } = await getSettings();
  const next = !presentationMode;
  await saveSettings({ presentationMode: next, enabled: next ? true : enabled });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (on) => window.__wps?.setPresentationMode?.(on),
    args: [next],
  });
}

async function toggleHoverMode(tabId) {
  const { hoverMode } = await getSettings();
  const next = !hoverMode;
  await saveSettings({ hoverMode: next });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (on) => window.__wps?.setHoverMode?.(on),
    args: [next],
  });
}

async function panic(tabId) {
  await saveSettings({ enabled: true, locked: true, presentationMode: false });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__wps?.panic?.(),
  });
}

/**
 * Send a message to all open WhatsApp Web tabs.
 */
async function broadcastToWhatsApp(message) {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Tab may not have content script loaded yet — ignore
      });
    }
  }
}

/**
 * Check if current time falls within the scheduled blur window.
 */
async function checkSchedule() {
  const settings = await getSettings();
  if (!settings.scheduleEnabled) return;

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun, 6 = Sat
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = settings.scheduleStart.split(':').map(Number);
  const [endH, endM] = settings.scheduleEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const inScheduledDays = settings.scheduleDays.includes(dayOfWeek);
  const inScheduledTime = currentMinutes >= startMinutes && currentMinutes < endMinutes;
  const shouldBlur = inScheduledDays && inScheduledTime;

  if (shouldBlur !== settings.enabled) {
    await saveSettings({ enabled: shouldBlur });
    await broadcastToWhatsApp({ type: shouldBlur ? 'REBLUR' : 'UNBLUR' });
  }
}
