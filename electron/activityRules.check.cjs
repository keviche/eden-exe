"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyWindow, decideActivity, matchDomain, IDLE_THRESHOLD_SECONDS,
} = require("./activityRules.cjs");

const classify = (appName, windowTitle = "", url = "", bundleId = "") =>
  classifyWindow({ appName, windowTitle, url, bundleId }).category;
const decide = (args) => decideActivity(args);

// These assertions exercise the real classifier used by Electron.
describe("Eden deterministic application and domain rules", () => {
  it("recognizes productive desktop tools and documents", () => {
    for (const app of ["Code", "Visual Studio Code", "Cursor", "Terminal", "Notion", "Obsidian", "Preview", "Skim", "PDF Expert", "Zotero", "Microsoft Word", "RStudio", "Anki"]) {
      assert.equal(classify(app, "Anything"), "productivity", app);
    }
  });
  it("recognizes leisure apps and audio apps", () => {
    for (const app of ["Steam", "Discord", "Spotify", "VLC", "IINA", "Roblox"]) {
      assert.equal(classify(app), "leisure", app);
    }
  });
  it("uses domain boundaries, not misleading title or substring matches", () => {
    assert.equal(classify("Google Chrome", "Notion tutorial", "https://www.reddit.com/"), "leisure");
    assert.equal(classify("Safari", "I love coding", "https://www.netflix.com/watch/7"), "leisure");
    assert.equal(classify("Safari", "Productivity", "https://docs.google.com/document/1"), "productivity");
    assert.equal(classify("Brave Browser", "", "https://arxiv.org/abs/123"), "productivity");
    assert.equal(classify("Google Chrome", "", "https://fakegithub.com"), "leisure");
    assert.equal(classify("Google Chrome", "", "https://evil.notgithub.com"), "leisure");
    assert.equal(matchDomain("evilgithub.com", "github.com"), false);
    assert.equal(matchDomain("gist.github.com", "github.com"), true);
  });
  it("does not assume unknown apps and sites are productive", () => {
    assert.equal(classify("RandomSomething"), "leisure");
    assert.equal(classify("Google Chrome", "", "https://www.unknownwebsite.xyz"), "leisure");
    assert.equal(classify("Google Chrome", "Notion tutorial - Google Chrome"), "leisure");
    assert.equal(classify("Google Chrome", "Essay - Google Docs - Google Chrome"), "productivity");
    assert.equal(classify("Google Chrome", "Lecture.pdf - Google Chrome"), "productivity");
  });
  it("supports explicit app and domain overrides", () => {
    const custom = { apps: { "com.custom.Editor": "productivity" }, domains: { "youtube.com": "productivity", "example.school": "productivity" } };
    assert.equal(classifyWindow({ appName: "Random", bundleId: "com.custom.Editor" }, custom).category, "productivity");
    assert.equal(classifyWindow({ appName: "Google Chrome", url: "https://www.youtube.com/watch?v=1" }, custom).category, "productivity");
    assert.equal(classifyWindow({ appName: "Safari", url: "https://learn.example.school/course" }, custom).category, "productivity");
    assert.equal(classifyWindow({ appName: "Safari", url: "https://example.school.evil.com" }, custom).category, "leisure");
  });
});

describe("Eden AFK and media decisions", () => {
  const now = 1_700_000_000_000;
  const youtube = { appName: "Google Chrome", windowTitle: "Movie - YouTube", url: "https://www.youtube.com/watch?v=123" };
  const playing = { browser: "chrome", hostname: "www.youtube.com", title: "Movie - YouTube", playing: true, at: now - 1000 };
  it("uses an exact three-minute threshold", () => {
    assert.equal(IDLE_THRESHOLD_SECONDS, 180);
    assert.equal(decide({ appName: "Code", idleSeconds: 179, now }).category, "productivity");
    assert.equal(decide({ appName: "Code", idleSeconds: 180, now }).category, "idle");
  });
  it("keeps music-only playback idle while AFK", () => {
    assert.equal(decide({ appName: "Spotify", idleSeconds: 200, now }).category, "idle");
    assert.equal(decide({ appName: "Google Chrome", url: "https://music.youtube.com/watch", idleSeconds: 200, now, media: playing }).category, "idle");
    assert.equal(decide({ appName: "Code", idleSeconds: 200, now }).category, "idle");
  });
  it("counts only verified, fresh, matching browser video while AFK", () => {
    assert.equal(decide({ ...youtube, idleSeconds: 400, now, media: playing }).category, "leisure");
    assert.equal(decide({ ...youtube, idleSeconds: 400, now, media: { ...playing, playing: false } }).category, "idle");
    assert.equal(decide({ ...youtube, idleSeconds: 400, now, media: { ...playing, at: now - 20_000 } }).category, "idle");
    assert.equal(decide({ ...youtube, idleSeconds: 400, now, media: { ...playing, hostname: "www.netflix.com" } }).category, "idle");
    assert.equal(decide({ ...youtube, windowTitle: "Different tab - YouTube", idleSeconds: 400, now, media: playing }).category, "idle");
    assert.equal(decide({ ...youtube, idleSeconds: 400, now, media: { ...playing, browser: "brave" } }).category, "idle");
    assert.equal(decide({ ...youtube, idleSeconds: 400, now }).category, "idle");
  });
  it("does not count movies while the screen is locked", () => {
    assert.equal(decide({ ...youtube, idleSeconds: 400, systemState: "locked", now, media: playing }).category, "idle");
  });
  it("handles packaged browser builds without URL when titles match", () => {
    assert.equal(decide({ appName: "Google Chrome", windowTitle: "Movie - YouTube - Google Chrome", idleSeconds: 200, now, media: playing }).category, "leisure");
    assert.equal(decide({ appName: "Google Chrome", windowTitle: "Different - YouTube", idleSeconds: 200, now, media: playing }).category, "idle");
  });
  it("preserves native movie-player fallback and idle music exception", () => {
    assert.equal(decide({ appName: "QuickTime Player", idleSeconds: 300, now }).category, "leisure");
    assert.equal(decide({ appName: "Music", idleSeconds: 300, now }).category, "idle");
  });
});
