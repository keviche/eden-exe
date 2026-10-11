/* global chrome */
"use strict";
// The browser reports ONLY the currently focused tab's hostname and title.
// No tab history, full URL, query strings, screenshots or keystrokes are stored.
const ENDPOINT = "http://127.0.0.1:43761/media";
const FRAME_TTL_MS = 6500;
const frameStates = new Map();
const lastSent = new Map();

async function publish(tabId, windowId, force = false) {
  try {
    const [tab, win, config] = await Promise.all([
      chrome.tabs.get(tabId),
      chrome.windows.get(windowId),
      chrome.storage.local.get(["pairingCode", "browser"]),
    ]);
    if (!tab.active || !win.focused || !config.pairingCode) return;
    if (!["chrome", "brave", "edge"].includes(config.browser)) return;
    let hostname = "";
    try {
      const url = new URL(tab.url || "");
      if (["http:", "https:"].includes(url.protocol)) hostname = url.hostname.toLowerCase();
    } catch { /* Browser internal/new-tab pages do not have hostnames. */ }
    const title = String(tab.title || "").slice(0, 300);
    const now = Date.now();
    let playing = false;
    for (const [key, state] of frameStates.entries()) {
      if (now - state.at > FRAME_TTL_MS) { frameStates.delete(key); continue; }
      if (state.tabId === tabId && state.playing) playing = true;
    }
    // Ignore duplicate tab-update events but allow periodic keepalive.
    const signature = `${tabId}:${hostname}:${title}:${playing}`;
    const previous = lastSent.get(config.browser);
    if (!force && previous?.signature === signature && now - previous.at < 2500) return;
    const reply = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Eden-Token": config.pairingCode },
      body: JSON.stringify({ browser: config.browser, hostname, title, playing }),
    });
    if (reply.ok) lastSent.set(config.browser, { signature, at: now });
  } catch { /* Browser may be closing or Eden not running. */ }
}
async function publishCurrent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id != null && tab.windowId != null) await publish(tab.id, tab.windowId, true);
  } catch { /* Browser may have no window. */ }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "EDEN_VIDEO_STATE" || typeof message.playing !== "boolean") return;
  if (!sender.tab || !Number.isInteger(sender.frameId)) return;
  frameStates.set(`${sender.tab.id}:${sender.frameId}`, {
    tabId: sender.tab.id, playing: message.playing, at: Date.now(),
  });
  void publish(sender.tab.id, sender.tab.windowId, true);
});
chrome.tabs.onActivated.addListener(info => void publish(info.tabId, info.windowId, true));
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (tab.active && ("url" in change || "title" in change || change.status === "complete")) {
    void publish(tabId, tab.windowId, true);
  }
});
chrome.windows.onFocusChanged.addListener(windowId => {
  if (windowId >= 0) void publishCurrent();
});
chrome.tabs.onRemoved.addListener(tabId => {
  for (const key of frameStates.keys()) {
    if (key.startsWith(`${tabId}:`)) frameStates.delete(key);
  }
});

// MV3 service workers are suspended. An alarm (not setInterval) refreshes
// current-site classification reliably on Chrome/Edge/Brave >= 120.
const startAlarm = () => chrome.alarms.create("eden-tab-heartbeat", { periodInMinutes: 0.5 });
chrome.runtime.onInstalled.addListener(() => { startAlarm(); void publishCurrent(); });
chrome.runtime.onStartup.addListener(() => { startAlarm(); void publishCurrent(); });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "eden-tab-heartbeat") void publishCurrent();
});
void startAlarm();
void publishCurrent();
