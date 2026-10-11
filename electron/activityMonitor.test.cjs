const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
  if (request === "electron") {
    return {
      powerMonitor: {
        getSystemIdleTime: () => 0
      }
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const {
  classifyActivity,
  classifyUrl,
  domainMatches,
  IDLE_THRESHOLD_SECONDS,
  CHECK_INTERVAL_MS
} = require("./activityMonitor.cjs");

Module._load = originalLoad;

test("Idle threshold remains 10 seconds", () => {
  assert.equal(IDLE_THRESHOLD_SECONDS, 10);
});

test("Polling remains every 2 seconds", () => {
  assert.equal(CHECK_INTERVAL_MS, 2000);
});

test("VS Code is productivity", () => {
  assert.equal(classifyActivity("Code", "eden-exe"), "productivity");
});

test("ChatGPT is productivity by URL", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "Generate Status Script",
      "https://chatgpt.com/c/123"
    ),
    "productivity"
  );
});

test("GitHub is productivity by URL", () => {
  assert.equal(
    classifyUrl("https://github.com/keviche/eden-exe"),
    "productivity"
  );
});

test("Google Docs is productivity", () => {
  assert.equal(
    classifyUrl("https://docs.google.com/document/d/123"),
    "productivity"
  );
});

test("LeetCode is productivity", () => {
  assert.equal(
    classifyUrl("https://leetcode.com/problems/two-sum"),
    "productivity"
  );
});

test("arXiv is productivity", () => {
  assert.equal(
    classifyUrl("https://arxiv.org/abs/1234.5678"),
    "productivity"
  );
});

test("YouTube is leisure", () => {
  assert.equal(
    classifyUrl("https://www.youtube.com/watch?v=123"),
    "leisure"
  );
});

test("Netflix is leisure", () => {
  assert.equal(
    classifyUrl("https://www.netflix.com/watch/123"),
    "leisure"
  );
});

test("Steam is leisure", () => {
  assert.equal(
    classifyUrl("https://store.steampowered.com/app/123"),
    "leisure"
  );
});

test("Spotify is leisure", () => {
  assert.equal(
    classifyUrl("https://open.spotify.com/track/123"),
    "leisure"
  );
});

test("Reddit is ambiguous", () => {
  assert.equal(
    classifyUrl("https://reddit.com/r/programming"),
    "unknown"
  );
});

test("LinkedIn is ambiguous", () => {
  assert.equal(
    classifyUrl("https://linkedin.com/feed"),
    "unknown"
  );
});

test("Google Search is ambiguous", () => {
  assert.equal(
    classifyUrl("https://www.google.com/search?q=python"),
    "unknown"
  );
});

test("Unknown websites stay internally unknown", () => {
  assert.equal(
    classifyUrl("https://example.com"),
    "unknown"
  );
});

test("Lookalike domains are not matched", () => {
  assert.equal(
    classifyUrl("https://github.com.evil.example"),
    "unknown"
  );
});

test("Specific subdomains are matched", () => {
  assert.equal(
    domainMatches("www.github.com", "github.com"),
    true
  );
});

test("URL classification overrides misleading titles", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "ChatGPT Tutorial",
      "https://www.youtube.com/watch?v=123"
    ),
    "leisure"
  );
});

test("Notion remains productivity", () => {
  assert.equal(
    classifyUrl("https://www.notion.so/workspace"),
    "productivity"
  );
});

test("Unsupported schemes are unknown", () => {
  assert.equal(classifyUrl("chrome://settings"), "unknown");
});


test("Wikipedia is productivity", () => {
  assert.equal(
    classifyUrl("https://en.wikipedia.org/wiki/Computer_science"),
    "productivity"
  );
});

test("Wiktionary is productivity", () => {
  assert.equal(
    classifyUrl("https://en.wiktionary.org/wiki/algorithm"),
    "productivity"
  );
});

test("Merriam-Webster is productivity", () => {
  assert.equal(
    classifyUrl("https://www.merriam-webster.com/dictionary/algorithm"),
    "productivity"
  );
});

test("Dictionary.com is productivity", () => {
  assert.equal(
    classifyUrl("https://www.dictionary.com/browse/algorithm"),
    "productivity"
  );
});

test("Cambridge Dictionary is productivity", () => {
  assert.equal(
    classifyUrl("https://dictionary.cambridge.org/dictionary/english/algorithm"),
    "productivity"
  );
});

test("Oxford Learner's Dictionaries is productivity", () => {
  assert.equal(
    classifyUrl("https://www.oxfordlearnersdictionaries.com/definition/english/algorithm"),
    "productivity"
  );
});

test("Britannica is productivity", () => {
  assert.equal(
    classifyUrl("https://www.britannica.com/science/mathematics"),
    "productivity"
  );
});

test("Thesaurus.com is productivity", () => {
  assert.equal(
    classifyUrl("https://www.thesaurus.com/browse/learn"),
    "productivity"
  );
});

test("Google Translate is productivity", () => {
  assert.equal(
    classifyUrl("https://translate.google.com/"),
    "productivity"
  );
});

test("Wikipedia title fallback is productivity", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "Algorithm - Wikipedia",
      ""
    ),
    "productivity"
  );
});

test("Dictionary title fallback is productivity", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "Algorithm Definition - Merriam-Webster",
      ""
    ),
    "productivity"
  );
});

test("Unrelated domains remain unknown", () => {
  assert.equal(
    classifyUrl("https://notwikipedia.org"),
    "unknown"
  );
});

test("YouTube remains leisure", () => {
  assert.equal(
    classifyUrl("https://www.youtube.com/watch?v=123"),
    "leisure"
  );
});


test("Gmail is productivity by URL", () => {
  assert.equal(
    classifyUrl("https://mail.google.com/mail/u/0/#inbox"),
    "productivity"
  );
});

test("Gmail is productivity by window title", () => {
  assert.equal(
    classifyActivity("Google Chrome", "Inbox (3) - Gmail", ""),
    "productivity"
  );
});

test("Gmail lookalike domains are not productivity", () => {
  assert.equal(
    classifyUrl("https://mail.google.com.evil.example"),
    "unknown"
  );
});


test("Microsoft Outlook is productivity", () => {
  assert.equal(
    classifyActivity("Microsoft Outlook", "Inbox"),
    "productivity"
  );
});

test("Microsoft Word is productivity", () => {
  assert.equal(
    classifyActivity("Microsoft Word", "Document1"),
    "productivity"
  );
});

test("Microsoft PowerPoint is productivity", () => {
  assert.equal(
    classifyActivity("Microsoft PowerPoint", "Presentation1"),
    "productivity"
  );
});

test("Microsoft Excel is productivity", () => {
  assert.equal(
    classifyActivity("Microsoft Excel", "Workbook1"),
    "productivity"
  );
});

test("Microsoft OneNote is productivity", () => {
  assert.equal(
    classifyActivity("Microsoft OneNote", "Notes"),
    "productivity"
  );
});

test("Microsoft Teams is productivity", () => {
  assert.equal(
    classifyActivity("Microsoft Teams", "Meeting"),
    "productivity"
  );
});

test("Apple Mail is productivity", () => {
  assert.equal(
    classifyActivity("Mail", "Inbox"),
    "productivity"
  );
});

test("Apple Keynote is productivity", () => {
  assert.equal(
    classifyActivity("Keynote", "Presentation"),
    "productivity"
  );
});

test("Slack is productivity", () => {
  assert.equal(
    classifyActivity("Slack", "Workspace"),
    "productivity"
  );
});

test("Docker Desktop is productivity", () => {
  assert.equal(
    classifyActivity("Docker Desktop", "Containers"),
    "productivity"
  );
});

test("Spotify remains leisure", () => {
  assert.equal(
    classifyActivity("Spotify", "Playlist"),
    "leisure"
  );
});

test("Chrome ChatGPT remains productivity", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "Generate Status Script",
      "https://chatgpt.com/c/123"
    ),
    "productivity"
  );
});

test("Chrome YouTube remains leisure", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "Video title",
      "https://www.youtube.com/watch?v=123"
    ),
    "leisure"
  );
});
