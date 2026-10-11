"use strict";
const { powerMonitor } = require("electron");
const fs = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { classifyWindow, decideActivity, isBrowser, matchDomain, IDLE_THRESHOLD_SECONDS } = require("./activityRules.cjs");
const { normalizeForeground, createWindowsForegroundReader } = require("./windowsForeground.cjs");

const execFileAsync = promisify(execFile);
const CHECK_INTERVAL_MS = 5000;
const MEDIA_TAB_MAX_AGE_MS = 45_000; // extension alarms refresh every 30s
const MAC_URL_TIMEOUT_MS = 1300;
let activeWinLoader = null;

async function defaultActiveWin() {
  if (!activeWinLoader) activeWinLoader = import("active-win").then(module => module.default).catch(error => {
    console.warn("[EDEN] active-win unavailable:", error.message);
    return null;
  });
  const fn = await activeWinLoader;
  if (!fn) return null;
  // Only one polling pass runs at a time, even if this call is slow.
  return fn();
}

const MAC_CHROMIUM = {
  chrome: "Google Chrome", brave: "Brave Browser", edge: "Microsoft Edge",
};
async function macChromeUrl(browser) {
  if (process.platform !== "darwin" || !MAC_CHROMIUM[browser]) return "";
  const name = MAC_CHROMIUM[browser];
  const script = `tell application "${name}"\nif (count windows) = 0 then return ""\nreturn URL of active tab of front window\nend tell`;
  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script], {
      timeout: MAC_URL_TIMEOUT_MS, maxBuffer: 4096,
    });
    return stdout.trim();
  } catch { return ""; }
}

function matchBrowserReport(context, report) {
  if (!report || !report.browser) return false;
  if (isBrowser(context.appName, context.bundleId) !== report.browser) return false;
  const name = String(context.windowTitle || "").trim().toLowerCase()
    .replace(/\s+[-|]\s+(google chrome|brave|brave browser|microsoft edge)$/, "");
  const title = String(report.title || "").trim().toLowerCase();
  // URL titles can be absent for transient navigation. Do NOT borrow a stale
  // browser hostname just because the browser executable still matches.
  if (name && title && name !== title &&
      !name.startsWith(`${title} - `) && !name.endsWith(` - ${title}`)) return false;
  if (name && !title) return false;
  if (!name && !context.url) return false;
  if (context.url && report.hostname) {
    try {
      const url = new URL(context.url);
      if (["http:", "https:"].includes(url.protocol) &&
          !(matchDomain(url.hostname, report.hostname) && matchDomain(report.hostname, url.hostname))) return false;
    } catch { /* Browser may be on an internal page. */ }
  }
  return true;
}

function createActivityMonitor(onStatusChange, options = {}) {
  const platform = options.platform || process.platform;
  const mediaBridge = options.mediaBridge || null;
  const rulesPath = options.rulesPath || null;
  const capture = options.getActiveWindow || defaultActiveWin;
  const power = options.powerMonitor || powerMonitor;
  const fallback = platform === "win32" ? (options.windowsReader || createWindowsForegroundReader({
    scriptPath: options.windowsScriptPath,
  })) : null;
  let interval = null;
  let running = false;
  let busy = false;
  let locked = false;
  let suspended = false;
  let last = null;
  let customRules = { apps: {}, domains: {} };
  let lastRulesRead = 0;

  async function readRules() {
    if (!rulesPath || Date.now() - lastRulesRead < CHECK_INTERVAL_MS) return;
    lastRulesRead = Date.now();
    try {
      const value = JSON.parse(await fs.readFile(rulesPath, "utf8"));
      if (value && typeof value === "object" && !Array.isArray(value)) customRules = value;
    } catch (error) {
      if (error.code !== "ENOENT") console.warn("[EDEN] Invalid activity-rules.json; keeping last valid rules:", error.message);
    }
  }
  function idleReading() {
    let seconds = 0;
    let systemState = "unknown";
    try { seconds = power.getSystemIdleTime(); } catch { /* Unsupported powerMonitor state. */ }
    try { systemState = power.getSystemIdleState(IDLE_THRESHOLD_SECONDS); } catch { /* Fallback to idleSeconds. */ }
    if (locked) systemState = "locked";
    if (suspended) systemState = "suspended";
    return { idleSeconds: seconds, systemState };
  }

  async function check() {
    if (!running || busy) return;
    busy = true;
    try {
      await readRules();
      const idle = idleReading();
      let context = { appName: "", windowTitle: "", bundleId: "", url: "" };
      if (!suspended && !locked) {
        try { context = normalizeForeground(await capture(), platform) || context; }
        catch (error) { console.warn("[EDEN] Foreground read failed:", error.message); }
        if (platform === "win32" && !context.appName && fallback) {
          context = await fallback.read() || context;
        }
      }
      const browser = isBrowser(context.appName, context.bundleId);
      const media = browser && mediaBridge?.getStatus(browser, MEDIA_TAB_MAX_AGE_MS);
      if (browser && !context.url && media && matchBrowserReport(context, media)) {
        // Only retain hostnames (never complete URLs, tabs, or query strings).
        if (media.hostname) context.url = `https://${media.hostname}/`;
      }
      if (browser && !context.url && platform === "darwin") {
        context.url = await macChromeUrl(browser);
      }
      const videoEvidence = media && matchBrowserReport(context, media) ? media : null;
      const decision = decideActivity({
        ...context, ...idle, media: videoEvidence, now: Date.now(),
      }, customRules);
      if (!running) return;
      const state = {
        status: decision.status,
        category: decision.category,
        reason: decision.reason,
        appName: context.appName || "Unknown",
        idleSeconds: Math.max(0, Number(idle.idleSeconds) || 0),
        source: context.appName ? "foreground-window" : "unavailable",
        timestamp: Date.now(),
      };
      const changed = !last || ["status", "category", "reason", "appName", "source"].some(key => last[key] !== state[key]);
      last = state;
      if (changed) onStatusChange({ ...state });
    } catch (error) {
      console.warn("[EDEN] Activity check failed:", error.message);
    } finally { busy = false; }
  }
  const transitions = {
    "lock-screen": () => { locked = true; void check(); },
    "unlock-screen": () => { locked = false; void check(); },
    suspend: () => { suspended = true; void check(); },
    resume: () => { suspended = false; void check(); },
    "user-did-become-active": () => void check(),
  };
  return {
    start() {
      if (running) return;
      running = true;
      for (const [event, callback] of Object.entries(transitions)) {
        power.on?.(event, callback);
      }
      void check();
      interval = setInterval(() => void check(), CHECK_INTERVAL_MS);
    },
    stop() {
      running = false;
      if (interval !== null) clearInterval(interval);
      interval = null;
      for (const [event, callback] of Object.entries(transitions)) {
        power.removeListener?.(event, callback);
      }
      fallback?.stop();
    },
    refresh: () => void check(),
    getStatus: () => last && { ...last },
  };
}

module.exports = {
  createActivityMonitor, matchBrowserReport, IDLE_THRESHOLD_SECONDS, CHECK_INTERVAL_MS,
};
