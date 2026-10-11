# Eden.exe Browser Activity Companion (Chrome, Microsoft Edge, Brave)

This is an **optional**, local-only extension for accurate Windows browser
classification and visible video playback detection on Windows or macOS.

1. Run Eden.exe on your computer (`npm run dev:desktop` when developing).
2. Open the browser's extensions page (`chrome://extensions`,
   `edge://extensions`, or `brave://extensions`), enable Developer mode, and
   **Load unpacked** → select this `browser-extension` folder. In an
   installed Eden.exe build, use **Open browser extension folder** in Build.
3. Open Eden's **Build** panel and choose **Copy browser pairing key**.
4. In the extension popup, choose Chrome/Edge/Brave correctly, paste the key,
   and click **Save pairing**.
5. Switch between GitHub/Google Docs and YouTube, and look at Eden's activity
   status. At least one browser window must be focused.

**Privacy**: The `tabs` permission allows the extension to see browser tab
URLs. It sends **only the hostname** (e.g. `github.com`), the currently active
tab's title, and a boolean indicating whether a supported foreground video is
playing to `http://127.0.0.1:43761/media` **on your own machine**. It does not
send paths, query strings, screenshots, keypresses, or browsing history. No
remote server or analytics API is involved. The app keeps only the latest
samples in memory. A 64-character pairing code authenticates the local bridge.

The `alarms` permission supports periodic (30-second) refreshing when the MV3
background worker sleeps. Tab-switch events update immediately. Video playback
on supported sites is checked by limited content scripts, not by capturing
screen frames. Only fresh, matching HTML video playback can override the 3-min
physical idle threshold. Audio-only playback remains Idle when AFK. Websites
with DRM or custom video players may not supply usable video evidence.

On macOS, AppleScript can independently identify some Chromium tabs, depending
on Automation permissions. On Windows, reliable per-website classification
normally requires the extension. Without it, Eden still tracks active apps and
uses conservative window-title fallback for recognizable browser sites.

Firefox and Safari extensions are not included. Use **Edit activity rules** in
the Build panel to reveal your platform-specific `activity-rules.json` file.
