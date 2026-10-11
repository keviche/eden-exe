# Eden.exe desktop: Windows + macOS

This revision targets **Windows 10/11 (x64)** and macOS. It uses the *same*
Zustand/React simulation and deterministic activity classification on both.

## Run from source

Install Node.js 22 (or a newer supported Node.js release) and Git.

```sh
npm ci
npm run test:activity
npm test
npm run build
npm run dev:desktop
```

On Windows, run these commands in **PowerShell** or Windows Terminal after
opening the project directory. `npm run dev:desktop` launches Vite and Electron.
You do **not** need to install PowerShell modules or change your system's
execution policy: Eden launches the bundled Windows PowerShell helper only if
`active-win` cannot read the active window.

## Activity monitoring (both operating systems)

- A shared five-second watchdog uses `active-win` to identify the foreground
  application and window title. Electron's `powerMonitor` reports physical idle
  time, screen locking and suspend/resume. Three minutes without physical input
  counts as idle, except for specifically detected *visible* video playback.
- **Windows**: Process identities like `Code.exe`, `msedge.exe`, `WINWORD.EXE`,
  and `powerpnt.exe` are normalized. A single persistent native Win32 API helper
  (via bundled Windows PowerShell) is used when `active-win` fails. It reads
  only foreground process name and window title; it never takes screenshots,
  reads keyboard input, or stores browsing history.
- **macOS**: The same deterministic rules are used. `active-win` and optional
  AppleScript tab URL lookup are retained for Chrome/Brave/Edge. macOS may ask
  for **Accessibility** or **Automation** permissions depending on your setup.
- A missing foreground reading is labeled **Unknown** in the Build controls;
  category fallback remains Leisure, not an invented productivity score.
- No user account, analytics server, remote network requests or cloud database
  are required. Classification runs in the Electron main process.

## Browser website classification on Windows (recommended)

The foreground Windows API cannot reliably provide the *URL of the current
browser tab*. For accurate Chrome/Edge/Brave site classification, load the
included **browser-extension** folder as an *unpacked extension*:

1. Start Eden.exe.
2. In Edge open `edge://extensions`, or in Chrome `chrome://extensions`, or in
   Brave `brave://extensions`. Enable Developer mode; choose **Load unpacked**
   and select `<eden-project>/browser-extension` (or click **Open browser
   extension folder** in Eden after installation).
3. In Eden's **Build** panel choose **Copy browser pairing key**.
4. Open the extension popup, select the right browser, paste the key and save.
5. Switch between GitHub/Google Docs and YouTube/Netflix. Eden's Build panel
   displays the detected application, category and classification reason.

The extension requests `tabs`, `storage`, and `alarms` permissions. It can read
**current browser tab** URLs for classification, but sends **only the hostname**
(e.g. `github.com`) and the foreground tab title to `127.0.0.1:43761` on your
own computer, authenticated with a random local pairing key. No history is
persisted or sent to a remote server. It uses a 30-second Chrome alarm to keep
the active tab hostname fresh, and updates immediately on tab changes.

Video-site content scripts detect a visible, actively playing HTML `<video>`.
Only matching recent playback signals can override the idle timer, never mere
background audio. Some DRM players/embedded videos are not detectable.
Without the extension, app recognition and *distinctive browser title*
classification still work, but unknown sites may be classed as Leisure.

The browser extension does **not** support Firefox or Safari in this release.
Use its extension popup after reloading the extension; old pairing keys remain
valid as long as Eden's user-data folder is retained.

## Customize rules

Click **Edit activity rules** in Eden's Build panel to reveal the local
`activity-rules.json` in Finder or Windows Explorer. Example:

```json
{
  "apps": { "my special app": "productivity" },
  "domains": { "my-university.edu": "productivity" }
}
```

No restarts required; rules reload approximately every five seconds. Only
`productivity` and `leisure` are recognized as override values. This config
remains in Electron's OS-specific user data directory, not the repository.

## Windows installer and GitHub Actions

Build on a Windows computer:

```powershell
npm ci
npm run test:activity
npm test
npm run package:win
```

Look inside `release/` for a 64-bit `.exe` installer. Electron-builder packages
Vite's `dist/`, Electron main process, `active-win`, the browser
companion extension, and the PowerShell fallback.

Alternatively push this patch to your GitHub repository and run **Actions →
Build Eden desktop → Run workflow**. The workflow uses hosted **Windows and
macOS machines** to produce downloadable build artifacts. Windows output is an
NSIS `.exe` installer; macOS output is an unsigned zip archive.

**Important:** The Windows and macOS packages generated here are unsigned.
Windows SmartScreen and macOS Gatekeeper may warn users until you sign and
notarize production releases. Tests in a Linux sandbox cannot validate native
Windows APIs, Windows rendering transparency, or installer operation. Test on
an actual Windows machine before distributing.

## Window behavior

Windows transparent windows can behave incorrectly when resizable. The Windows
terrarium is therefore transparent and **not OS-resizable** in this patch;
macOS retains its existing resizable window. The Windows system tray provides
**Show Eden.exe** and **Quit Eden.exe**, so closing the frameless terrarium does
not trap an invisible background process. Right-click its tray icon to quit.

The code does not change the existing 3D aesthetic, 256× development speed,
Zustand persistence, building interactions, or bubble interactions.
