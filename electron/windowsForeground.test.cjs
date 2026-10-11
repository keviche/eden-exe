"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { windowsAppName, normalizeForeground } = require("./windowsForeground.cjs");
test("Windows program aliases normalize native process names", () => {
  const examples = [
    ["Code.exe", "Visual Studio Code"], ["msedge.exe", "Microsoft Edge"],
    ["chrome.exe", "Google Chrome"], ["WINWORD.EXE", "Microsoft Word"],
    ["POWERPNT.EXE", "Microsoft PowerPoint"], ["WindowsTerminal.exe", "Windows Terminal"],
    ["Discord.exe", "Discord"], ["C:\\Program Files\\Steam\\steam.exe", "Steam"],
  ];
  for (const [input, wanted] of examples) assert.equal(windowsAppName(input), wanted, input);
});
test("native active-win snapshots are normalized without persisting history", () => {
  const info = normalizeForeground({ owner: { name: "Code.exe", path: "C:\\VSCode\\Code.exe" }, title: "Project" }, "win32");
  assert.deepEqual(info, { appName: "Visual Studio Code", windowTitle: "Project", bundleId: "", url: "" });
  assert.equal(normalizeForeground(null, "win32"), null);
});
