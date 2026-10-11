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

test("Idle threshold is 10 seconds", () => {
  assert.equal(IDLE_THRESHOLD_SECONDS, 10);
});

test("Activity polling interval is 2 seconds", () => {
  assert.equal(CHECK_INTERVAL_MS, 2000);
});

test("VS Code is productivity", () => {
  assert.equal(classifyActivity("Code", "eden-exe"), "productivity");
});

test("Terminal is productivity", () => {
  assert.equal(classifyActivity("Terminal", "zsh"), "productivity");
});

test("Spotify is leisure", () => {
  assert.equal(classifyActivity("Spotify", "Music"), "leisure");
});

test("ChatGPT conversation title uses actual URL", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "Generate Status Script",
      "https://chatgpt.com/c/123"
    ),
    "productivity"
  );
});

test("GitHub repository page uses actual URL", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "keviche/eden-exe",
      "https://github.com/keviche/eden-exe"
    ),
    "productivity"
  );
});

test("Google Docs is productivity", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "Untitled document",
      "https://docs.google.com/document/d/123/edit"
    ),
    "productivity"
  );
});

test("YouTube is leisure", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "Video title",
      "https://www.youtube.com/watch?v=123"
    ),
    "leisure"
  );
});

test("Netflix is leisure", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "Movie title",
      "https://www.netflix.com/watch/123"
    ),
    "leisure"
  );
});

test("Domain matching includes subdomains", () => {
  assert.equal(domainMatches("www.github.com", "github.com"), true);
  assert.equal(domainMatches("github.com", "github.com"), true);
});

test("Lookalike domains do not match", () => {
  assert.equal(
    classifyUrl("https://github.com.evil.example"),
    null
  );
  assert.equal(
    classifyUrl("https://fakechatgpt.com"),
    null
  );
});

test("URL classification takes precedence over misleading titles", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "ChatGPT tutorial",
      "https://www.youtube.com/watch?v=123"
    ),
    "leisure"
  );
});

test("Notion remains productivity", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "My Notes | Notion",
      "https://www.notion.so/workspace"
    ),
    "productivity"
  );
});

test("Unrecognized Chrome website defaults to leisure", () => {
  assert.equal(
    classifyActivity(
      "Google Chrome",
      "Unknown page",
      "https://example.com"
    ),
    "leisure"
  );
});

test("Unsupported URL schemes are ignored", () => {
  assert.equal(classifyUrl("chrome://settings"), null);
});
