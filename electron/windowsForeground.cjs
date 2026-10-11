"use strict";
const { spawn } = require("node:child_process");
const path = require("node:path");

const EXE_ALIASES = Object.freeze({
  "code": "Visual Studio Code",
  "code - insiders": "Visual Studio Code Insiders",
  "cursor": "Cursor",
  "msedge": "Microsoft Edge",
  "chrome": "Google Chrome",
  "brave": "Brave Browser",
  "brave-browser": "Brave Browser",
  "firefox": "Firefox",
  "opera": "Opera",
  "vivaldi": "Vivaldi",
  "winword": "Microsoft Word",
  "excel": "Microsoft Excel",
  "powerpnt": "Microsoft PowerPoint",
  "onenote": "Microsoft OneNote",
  "outlook": "Microsoft Outlook",
  "teams": "Microsoft Teams",
  "ms-teams": "Microsoft Teams",
  "windowsterminal": "Windows Terminal",
  "wt": "Windows Terminal",
  "powershell": "PowerShell",
  "pwsh": "PowerShell",
  "cmd": "Command Prompt",
  "notepad": "Notepad",
  "explorer": "File Explorer",
  "devenv": "Visual Studio",
  "idea64": "IntelliJ IDEA",
  "pycharm64": "PyCharm",
  "webstorm64": "WebStorm",
  "steam": "Steam",
  "discord": "Discord",
  "vlc": "VLC",
  "spotify": "Spotify",
});

function windowsAppName(name, executable = "") {
  const raw = String(executable || name || "").split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, "").trim();
  const fallback = String(name || "").split(/[\\/]/).pop().replace(/\.exe$/i, "").trim();
  return EXE_ALIASES[raw] || EXE_ALIASES[fallback.toLowerCase()] || fallback;
}

function normalizeForeground(info, platform = process.platform) {
  if (!info || typeof info !== "object") return null;
  const owner = info.owner || {};
  const original = String(info.appName || owner.name || "").slice(0, 160);
  const executable = String(info.executable || owner.path || "").slice(0, 1024);
  return {
    appName: platform === "win32" ? windowsAppName(original, executable) : original,
    windowTitle: String(info.windowTitle || info.title || "").slice(0, 300),
    bundleId: String(info.bundleId || owner.bundleId || "").slice(0, 160),
    url: typeof info.url === "string" ? info.url.slice(0, 2048) : "",
  };
}

// A single persistent helper avoids launching PowerShell every five seconds.
// It runs only on Windows, and only when active-win cannot read foreground data.
function createWindowsForegroundReader(options = {}) {
  const spawnProcess = options.spawnProcess || spawn;
  const scriptPath = options.scriptPath || path.join(__dirname, "windowsForeground.ps1");
  const timeoutMs = options.timeoutMs || 3500;
  let child = null;
  let current = null;
  let stdout = "";
  let nextRetryAt = 0;
  let stopped = false;

  function settle(value) {
    if (!current) return;
    clearTimeout(current.timer);
    const resolve = current.resolve;
    current = null;
    resolve(value);
  }
  function discard() {
    const old = child;
    child = null;
    stdout = "";
    settle(null);
    if (old) {
      try { old.kill(); } catch { /* Already stopped. */ }
    }
  }
  function ensure() {
    if (stopped || Date.now() < nextRetryAt) return false;
    if (child && !child.killed) return true;
    try {
      const instance = spawnProcess("powershell.exe", [
        "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
        "-File", scriptPath,
      ], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
      child = instance;
      instance.stdout.setEncoding("utf8");
      instance.stdout.on("data", chunk => {
        stdout += chunk;
        if (stdout.length > 15000) { discard(); return; }
        let newline;
        while ((newline = stdout.indexOf("\n")) !== -1) {
          const line = stdout.slice(0, newline).trim();
          stdout = stdout.slice(newline + 1);
          if (!current) continue;
          try { settle(normalizeForeground(JSON.parse(line), "win32")); }
          catch { settle(null); }
        }
      });
      instance.on("error", () => { nextRetryAt = Date.now() + 30_000; if (child === instance) discard(); });
      instance.on("exit", () => { nextRetryAt = Date.now() + 10_000; if (child === instance) { child = null; settle(null); } });
      return true;
    } catch {
      nextRetryAt = Date.now() + 30_000;
      return false;
    }
  }
  return {
    read() {
      if (!ensure() || current) return Promise.resolve(null);
      return new Promise(resolve => {
        const timer = setTimeout(() => {
          nextRetryAt = Date.now() + 10_000;
          discard();
        }, timeoutMs);
        current = { resolve, timer };
        try { child.stdin.write("NEXT\n"); }
        catch { discard(); }
      });
    },
    stop() { stopped = true; discard(); },
  };
}

module.exports = { windowsAppName, normalizeForeground, createWindowsForegroundReader };
