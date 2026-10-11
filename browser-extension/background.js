/* global chrome */
"use strict";
const ENDPOINT = "http://127.0.0.1:43761/media";
const FRAME_TTL_MS = 6500;
const frameStates = new Map();

async function publish(tabId, windowId) {
  try {
    const [tab, win, config] = await Promise.all([
      chrome.tabs.get(tabId),
      chrome.windows.get(windowId),
      chrome.storage.local.get(["pairingCode", "browser"]),
    ]);
    if (!tab.active || !win.focused || !config.pairingCode) return;
    if (!["chrome", "brave", "edge"].includes(config.browser)) return;
    const url = new URL(tab.url || "");
    if (!/^https?:$/.test(url.protocol) || url.hostname === "music.youtube.com") return;
    const now = Date.now();
    let playing = false;
    for (const [key, state] of frameStates.entries()) {
      if (now - state.at > FRAME_TTL_MS) {
        frameStates.delete(key);
        continue;
      }
      if (state.tabId === tabId && state.playing) playing = true;
    }
    await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Eden-Token": config.pairingCode,
      },
      body: JSON.stringify({
        browser: config.browser,
        hostname: url.hostname.toLowerCase(),
        title: String(tab.title || "").slice(0, 300),
        playing,
      }),
    });
  } catch { /* Eden may not be running, or this tab may have closed. */ }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "EDEN_VIDEO_STATE" || typeof message.playing !== "boolean") return;
  if (!sender.tab || !Number.isInteger(sender.frameId)) return;
  frameStates.set(`${sender.tab.id}:${sender.frameId}`, {
    tabId: sender.tab.id, playing: message.playing, at: Date.now(),
  });
  void publish(sender.tab.id, sender.tab.windowId);
});

chrome.tabs.onActivated.addListener(info => void publish(info.tabId, info.windowId));
chrome.windows.onFocusChanged.addListener(async windowId => {
  if (windowId < 0) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) await publish(tab.id, windowId);
  } catch { /* Browser window closed. */ }
});
chrome.tabs.onRemoved.addListener(tabId => {
  for (const key of frameStates.keys()) {
    if (key.startsWith(`${tabId}:`)) frameStates.delete(key);
  }
});
