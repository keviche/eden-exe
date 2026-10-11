"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("node:events");
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
  if (name === "electron") return { powerMonitor: new EventEmitter() };
  return originalLoad.call(this, name, parent, isMain);
};
const { createActivityMonitor, matchBrowserReport, IDLE_THRESHOLD_SECONDS, CHECK_INTERVAL_MS } = require("./activityMonitor.cjs");
Module._load = originalLoad;

function powerMock() {
  const mock = new EventEmitter();
  mock.seconds = 0;
  mock.state = "active";
  mock.getSystemIdleTime = () => mock.seconds;
  mock.getSystemIdleState = () => mock.state;
  return mock;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 40));

test("cross-platform idle threshold and polling cadence", () => {
  assert.equal(IDLE_THRESHOLD_SECONDS, 180);
  assert.equal(CHECK_INTERVAL_MS, 5000);
});
test("Windows app names, desktop switching and lock state", async () => {
  const power = powerMock();
  const events = [];
  let window = { owner: { name: "Code.exe", path: "C:\\Program Files\\VS Code\\Code.exe" }, title: "Project - Visual Studio Code" };
  const fallback = { read: async () => null, stop: () => {} };
  const monitor = createActivityMonitor(event => events.push(event), {
    platform: "win32", powerMonitor: power, windowsReader: fallback,
    getActiveWindow: async () => window,
  });
  try {
    monitor.start();
    await tick();
    assert.equal(events.at(-1)?.category, "productivity");
    window = { owner: { name: "msedge.exe", path: "C:\\Program Files\\Edge\\msedge.exe" }, title: "Watch - YouTube - Microsoft Edge" };
    monitor.refresh();
    await tick();
    assert.equal(events.at(-1)?.category, "leisure");
    power.seconds = 190;
    monitor.refresh();
    await tick();
    assert.equal(events.at(-1)?.category, "idle");
    power.seconds = 0;
    power.emit("lock-screen");
    await tick();
    assert.equal(events.at(-1)?.status, "idle");
    power.emit("unlock-screen");
    await tick();
    assert.equal(events.at(-1)?.status, "active");
  } finally { monitor.stop(); }
});
test("Windows native fallback can detect browser even if active-win fails", async () => {
  const events = [];
  let stopped = false;
  const monitor = createActivityMonitor(event => events.push(event), {
    platform: "win32", powerMonitor: powerMock(),
    getActiveWindow: async () => { throw Error("native not available"); },
    windowsReader: { read: async () => ({ appName: "Google Chrome", windowTitle: "Project - GitHub" }), stop: () => { stopped = true; } },
  });
  monitor.start();
  await tick();
  assert.equal(events.at(-1)?.category, "productivity");
  monitor.stop();
  assert.equal(stopped, true);
});
test("Windows receives productive URL evidence from local extension", async () => {
  const events = [];
  const monitor = createActivityMonitor(event => events.push(event), {
    platform: "win32", powerMonitor: powerMock(),
    getActiveWindow: async () => ({ owner: { name: "msedge.exe" }, title: "Repository - GitHub - Microsoft Edge" }),
    windowsReader: { read: async () => null, stop: () => {} },
    mediaBridge: { getStatus: browser => browser === "edge" ? {
      browser: "edge", hostname: "github.com", title: "Repository - GitHub", playing: false, at: Date.now(),
    } : null },
  });
  try {
    monitor.start();
    await tick();
    assert.equal(events.at(-1)?.category, "productivity");
    assert.equal(events.at(-1)?.reason, "productive_website");
  } finally { monitor.stop(); }
});
test("browser companion requires matching foreground title, not just browser process", () => {
  const sample = { browser: "edge", hostname: "github.com", title: "Project - GitHub", playing: false };
  assert.equal(matchBrowserReport({ appName: "Microsoft Edge", windowTitle: "Project - GitHub - Microsoft Edge" }, sample), true);
  assert.equal(matchBrowserReport({ appName: "Microsoft Edge", windowTitle: "Other site - Microsoft Edge" }, sample), false);
  assert.equal(matchBrowserReport({ appName: "Google Chrome", windowTitle: "Project - GitHub" }, sample), false);
  assert.equal(matchBrowserReport({ appName: "Microsoft Edge", windowTitle: "" }, sample), false);
});
