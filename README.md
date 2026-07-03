# WhatsApp Privacy Shield 🛡️

> A production-quality Chrome Extension (Manifest V3) that protects your privacy on WhatsApp Web during screen shares, presentations, Zoom/Meet calls, and recordings.

---

## 👨‍💻 Author

| | |
|---|---|
| **Created by** | Techvyana2.0 |
| **YouTube Channel** | [youtube.com/channel/UCtOsvuTLp9qefl1yoQDqmPg/](https://youtube.com/channel/UCtOsvuTLp9qefl1yoQDqmPg/) |

> 💡 If you found this useful, consider subscribing to the channel for more tech tutorials and tools!

---

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Auto Privacy Mode** | Blurs all sensitive content the moment WhatsApp Web opens |
| 2 | **Profile Picture Blur** | Blurs contact and group DPs / avatars |
| 3 | **Hover Reveal** | Hover over any blurred element to temporarily reveal it |
| 4 | **Hold-to-Reveal** | Hold Ctrl (configurable) to reveal everything while held |
| 5 | **Password Unlock** | Require a password to disable blur, with auto-relock timer |
| 6 | **Panic Button** | Triple-ESC instantly re-blurs everything in milliseconds |
| 7 | **Blur Strength** | Low / Medium / High / Extreme / Pixelated + custom radius |
| 8 | **Smart Blur** | Choose exactly what to hide: avatars, names, messages, images, etc. |
| 9 | **Selective Reveal** | Eye icon per chat — reveal only that conversation |
| 10 | **Temporary Reveal** | Reveal for 10s / 30s / 60s, then auto-blur |
| 11 | **Keyboard Shortcuts** | Ctrl+Shift+B (toggle), Ctrl+Shift+P (presentation), etc. |
| 12 | **Presentation Mode** | Full overlay with privacy badge — ideal for projectors |
| 13 | **Fake Chat Mode** | Replace real messages with harmless placeholder text |
| 14 | **Hide Badges** | Replace unread-count badges with a neutral dot |
| 15 | **Auto-Lock** | Re-blur after configurable inactivity timeout |
| 16 | **Schedule Mode** | Blur only during office hours (Mon–Fri 9–6, configurable) |
| 17 | **Trusted Networks** | Mark Wi-Fi networks where blur should be disabled |
| 18 | **External Display Detection** | Auto-enters Presentation Mode when a second screen is connected |
| 19 | **Dark Mode Support** | Works with both WhatsApp light and dark themes |
| 20 | **Mutation Observer** | Blurs newly loaded messages / chats instantly as they appear |

---

## Privacy Guarantee

- ✅ **Zero data ever leaves your browser** — 100% local processing
- ✅ No analytics, telemetry, or tracking of any kind
- ✅ Minimum required Chrome permissions only
- ✅ Passwords stored as SHA-256 hashes — never plaintext

---

## Installation (Developer Mode)

### Prerequisites
- Google Chrome 88+ (Manifest V3 support)

### Steps

1. **Download & extract** the `whatsapp-privacy-shield.zip` file.

2. **Open Chrome Extensions**:
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in the top-right corner)

3. **Load the extension**:
   - Click **"Load unpacked"**
   - Select the extracted `whatsapp-privacy-shield` folder (the one that contains `manifest.json` directly inside it)
   - The shield icon should appear in the Chrome toolbar

4. **Open WhatsApp Web**:
   - Go to [https://web.whatsapp.com](https://web.whatsapp.com)
   - Privacy blur activates automatically ✅

> **After any update:** go to `chrome://extensions/` and click the ↺ refresh icon on the extension card, then hard-refresh WhatsApp Web (`Ctrl+Shift+R`).

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+B` | Toggle blur on/off |
| `Ctrl+Shift+P` | Toggle Presentation Mode |
| `Ctrl+Shift+H` | Toggle Hover Mode |
| `Ctrl+Shift+L` | Lock (instant blur) |
| Hold `Ctrl` | Reveal everything while held |
| `ESC × 3` | **Panic** — instant blur |

To customise shortcuts: `chrome://extensions/shortcuts`

---

## Smart Blur Categories

Control exactly what gets blurred from the popup or Options page:

| Toggle | What it hides |
|--------|--------------|
| **Avatars** | Profile pictures and group DPs |
| **Names** | Contact names and group titles |
| **Messages** | Chat bubble text |
| **Images** | Photos and media thumbnails |
| **Stickers** | Sticker messages |
| **Videos** | Video thumbnails and player |
| **Voice Notes** | Audio message waveforms |
| **Links** | URL previews |
| **Last Seen** | Online / last seen status |
| **About / Bio** | Contact about section |
| **Chat Preview** | Last message snippet in sidebar |
| **Badges** | Unread count bubbles |

---

## Folder Structure

```
whatsapp-privacy-shield/
├── manifest.json          # MV3 manifest
├── background.js          # Service worker (alarms, context menus, messages)
├── content-bundle.js      # Main content script injected into WhatsApp Web
├── storage.js             # Chrome Storage API wrapper + password hashing
├── popup.html/js/css      # Toolbar popup UI
├── options.html/js/css    # Full settings page
├── styles/
│   └── blur.css           # CSS injected into WhatsApp Web
├── assets/
│   └── icons/             # Extension icons (16, 32, 48, 128px)
└── generate-icons.sh      # Icon generation helper script
```

---

## Settings Overview

### Privacy
- Master enable/disable toggle
- Hover-to-reveal toggle
- Fake Chat Mode
- Smart Blur checkboxes (12 categories including avatar blur)

### Appearance
- Blur intensity: Low / Medium / High / Extreme / Pixelated / Custom
- Theme: System / Dark / Light

### Keyboard
- Hold-to-reveal key (Ctrl / Alt / Shift / Cmd)
- Panic key (ESC / F12 / F11) and press count

### Automation
- Auto-lock with configurable inactivity timeout
- Schedule mode (time range + day of week selection)
- Trusted Networks list

### Security
- Password enable/disable
- Set/change password (SHA-256 hashed)
- Unlock duration (auto-relock timer)

### Data & Backup
- Export settings as JSON
- Import settings from JSON
- Reset to defaults

---

## Testing Guide

1. **Smoke test**: Open WhatsApp Web → verify blur is applied immediately
2. **Avatar blur**: Profile pictures in the chat list should be blurred
3. **Hover reveal**: Hover over a chat row → element should unblur smoothly
4. **Hold key**: Hold Ctrl → everything unblurs; release → re-blurs
5. **Panic**: Press ESC three times rapidly → everything re-blurs
6. **Presentation mode**: Click "Presentation" in popup → overlay appears
7. **Timed reveal**: Select "30 seconds" in popup, click Reveal → countdown shows, auto-blurs
8. **Blur strength**: Change preset in popup → blur intensity changes live
9. **Smart blur**: Uncheck "Messages" → message text unblurs, names stay blurred
10. **Eye icon**: Click the eye icon on a chat row → only that chat reveals
11. **Auto-lock**: Set auto-lock to 15s, wait → blur re-enables automatically
12. **Settings persist**: Change settings, close/reopen popup → settings preserved
13. **Export/Import**: Export settings, reset, import → settings restored

---

## Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome 88+ | ✅ Full support | Manifest V3 |
| Edge 88+ | ✅ Full support | Chromium-based, MV3 |
| Brave | ✅ Full support | Chromium-based |
| Opera | ✅ Full support | Chromium-based |
| Firefox | ⚠️ Partial | Would need MV2 adaptation |
| Safari | ❌ Not supported | Different extension API |

---

## Performance Notes

- **MutationObserver** debounced at 80ms to avoid excessive reflows on message storms
- **CSS custom properties** (`--wps-blur`) used for radius changes — avoids re-applying classes
- **Content script** runs at `document_start` for zero-delay activation
- All state stored in `chrome.storage.local` — synchronous-style reads via async wrappers

---

## Future Enhancements

1. Screenshot prevention via print-screen key capture
2. Multi-profile support — different settings per WhatsApp account
3. Blur animation variants — fade, pixelate, grayscale transitions
4. Cloud sync — optional settings backup via `chrome.storage.sync`
5. Screen recording detection hook
6. Firefox port — Manifest V2 compatibility layer
7. Per-contact whitelist — permanently reveal specific contacts

---

## 📺 Watch the Tutorial

Learn how to install, configure, and use WhatsApp Privacy Shield on the **Techvyana2.0** YouTube channel:

🔗 **[youtube.com/channel/UCtOsvuTLp9qefl1yoQDqmPg/](https://youtube.com/channel/UCtOsvuTLp9qefl1yoQDqmPg/)**

---

*Built with Manifest V3 · Vanilla JavaScript · Chrome Storage & Commands APIs*  
*© Techvyana2.0 — All rights reserved*
