const { powerMonitor } = require("electron");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const IDLE_THRESHOLD_SECONDS = 10;
const CHECK_INTERVAL_MS = 2000;
const CHROME_URL_TIMEOUT_MS = 1500;

let activeWin = null;
let activeWinLoadAttempted = false;

const PRODUCTIVITY_APPS = new Set([
  "code",
  "visual studio code",
  "cursor",
  "terminal",
  "iterm",
  "iterm2",
  "xcode",
  "android studio",
  "intellij idea",
  "pycharm",
  "webstorm",
  "sublime text",
  "figma",
  "notion",
  "microsoft word",
  "microsoft excel",
  "microsoft powerpoint",
  "pages",
  "numbers",
  "keynote",
  "postman",
  "obsidian",
  "matlab",
  "rstudio",
  "r studio"
]);

const LEISURE_APPS = new Set([
  "spotify",
  "steam",
  "discord",
  "netflix",
  "twitch",
  "vlc",
  "vlc media player",
  "apple music",
  "music",
  "epic games launcher",
  "minecraft",
  "roblox"
]);

const BROWSERS = new Set([
  "google chrome",
  "chrome",
  "safari",
  "firefox",
  "arc",
  "brave",
  "brave browser",
  "microsoft edge",
  "opera"
]);

const CHROMIUM_BROWSERS = {
  "google chrome": "Google Chrome",
  "chrome": "Google Chrome",
  "brave browser": "Brave Browser",
  "brave": "Brave Browser",
  "microsoft edge": "Microsoft Edge"
};

const PRODUCTIVITY_DOMAINS = [
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "gemini.google.com",
  "perplexity.ai",
  "github.com",
  "gitlab.com",
  "stackoverflow.com",
  "leetcode.com",
  "docs.google.com",
  "sheets.google.com",
  "slides.google.com",
  "drive.google.com",
  "colab.research.google.com",
  "notion.so",
  "notion.site",
  "figma.com",
  "overleaf.com",
  "linear.app"
];

const LEISURE_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "netflix.com",
  "twitch.tv",
  "reddit.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "spotify.com",
  "twitter.com",
  "x.com",
  "hulu.com",
  "disneyplus.com",
  "primevideo.com",
  "crunchyroll.com",
  "pinterest.com",
  "roblox.com"
];

const PRODUCTIVITY_TITLES = [
  "chatgpt",
  "openai",
  "claude",
  "gemini",
  "perplexity",
  "github",
  "gitlab",
  "stack overflow",
  "leetcode",
  "google docs",
  "google sheets",
  "google slides",
  "google drive",
  "notion",
  "figma",
  "overleaf",
  "google colab",
  "linear"
];

const LEISURE_TITLES = [
  "youtube",
  "netflix",
  "twitch",
  "reddit",
  "instagram",
  "tiktok",
  "facebook",
  "spotify",
  "twitter",
  "hulu",
  "disney+",
  "prime video",
  "crunchyroll",
  "pinterest",
  "roblox"
];

function normalize(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\s+/g, " ")
    : "";
}

function containsPhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(
    "(^|[^a-z0-9])" + escaped + "(?=$|[^a-z0-9])",
    "i"
  ).test(text);
}

function domainMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith("." + domain);
}

function classifyUrl(url) {
  if (!url || typeof url !== "string") return null;

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");

  if (LEISURE_DOMAINS.some(domain => domainMatches(hostname, domain))) {
    return "leisure";
  }

  if (PRODUCTIVITY_DOMAINS.some(domain => domainMatches(hostname, domain))) {
    return "productivity";
  }

  return null;
}

function classifyActivity(appName, windowTitle, url = "") {
  const app = normalize(appName);
  const title = normalize(windowTitle);

  if (PRODUCTIVITY_APPS.has(app)) return "productivity";
  if (LEISURE_APPS.has(app)) return "leisure";

  if (BROWSERS.has(app)) {
    // Actual website domain takes priority over the page title.
    const urlCategory = classifyUrl(url);

    if (urlCategory) return urlCategory;

    // Fall back to window-title heuristics when URL access is unavailable.
    if (LEISURE_TITLES.some(site => containsPhrase(title, site))) {
      return "leisure";
    }

    if (PRODUCTIVITY_TITLES.some(site => containsPhrase(title, site))) {
      return "productivity";
    }

    if (
      /^pull requests?\s*[·|-]/.test(title) ||
      /^issues\s*[·|-]/.test(title) ||
      /^actions\s*[·|-]/.test(title) ||
      /^commits?\s*[·|-]/.test(title)
    ) {
      return "productivity";
    }
  }

  return "leisure";
}

async function getActiveChromeUrl(appName) {
  const browser = CHROMIUM_BROWSERS[normalize(appName)];

  if (!browser) return "";

  // This AppleScript only reads the URL of the active tab.
  // It does not read page content, cookies, or browsing history.
  //
  // macOS may request permission for Electron to control Chrome.
  // The user must explicitly approve that permission.
  const script = `
    tell application "System Events"
      set frontApp to name of first application process whose frontmost is true
    end tell
    if frontApp is not "${browser}" then
      return ""
    end if
    tell application "${browser}"
      if (count of windows) is 0 then
        return ""
      end if
      return URL of active tab of front window
    end tell
  `;

  try {
    const { stdout } = await execFileAsync(
      "osascript",
      ["-e", script],
      {
        timeout: CHROME_URL_TIMEOUT_MS,
        maxBuffer: 8192
      }
    );

    return stdout.trim();
  } catch {
    // No automation permission, unsupported browser,
    // timeout, or temporary tab-switching error.
    return "";
  }
}

async function initActiveWin() {
  if (activeWin || activeWinLoadAttempted) return;

  activeWinLoadAttempted = true;

  try {
    activeWin = (await import("active-win")).default;
  } catch (error) {
    console.error("[EDEN] Could not initialize active-win:", error);
  }
}

function createActivityMonitor(onStatusChange) {
  let intervalId = null;
  let lastState = null;
  let polling = false;
  let running = false;

  async function checkActivity() {
    if (!running || polling) return;

    polling = true;

    try {
      const idleSeconds = powerMonitor.getSystemIdleTime();
      const isIdle = idleSeconds >= IDLE_THRESHOLD_SECONDS;

      let appName = "";
      let windowTitle = "";
      let url = "";
      let category = "leisure";

      if (!isIdle) {
        await initActiveWin();

        if (activeWin) {
          try {
            const info = await activeWin();

            if (info?.owner) {
              appName = info.owner.name || "";
              windowTitle = info.title || "";

              // Read the active Chrome tab's actual URL when supported.
              if (CHROMIUM_BROWSERS[normalize(appName)]) {
                url = await getActiveChromeUrl(appName);
              }

              category = classifyActivity(appName, windowTitle, url);

              // Empty Chrome titles can occur during tab transitions.
              // Preserve the previous category briefly rather than
              // incorrectly switching to Leisure.
              if (
                BROWSERS.has(normalize(appName)) &&
                !windowTitle.trim() &&
                !url &&
                lastState?.status === "active" &&
                lastState.appName === appName
              ) {
                category = lastState.category;
              }
            }
          } catch (error) {
            if (lastState?.status === "active") {
              category = lastState.category;
            }
          }
        }
      }

      if (!running) return;

      const status = isIdle ? "idle" : "active";
      const resolvedCategory = isIdle ? "idle" : category;

      const changed =
        !lastState ||
        lastState.status !== status ||
        lastState.category !== resolvedCategory ||
        lastState.appName !== appName ||
        lastState.windowTitle !== windowTitle ||
        lastState.url !== url;

      if (!changed) return;

      lastState = {
        status,
        category: resolvedCategory,
        idleSeconds,
        appName,
        windowTitle,
        // Keep the URL internal. Do not send it to the UI or log it.
        url,
        timestamp: Date.now()
      };

      onStatusChange({
        status: lastState.status,
        category: lastState.category,
        idleSeconds: lastState.idleSeconds,
        appName: lastState.appName,
        windowTitle: lastState.windowTitle,
        timestamp: lastState.timestamp
      });
    } catch (error) {
      console.error("[EDEN] Activity polling error:", error);
    } finally {
      polling = false;
    }
  }

  return {
    start() {
      if (running) return;

      running = true;
      void checkActivity();

      intervalId = setInterval(() => {
        void checkActivity();
      }, CHECK_INTERVAL_MS);
    },

    stop() {
      running = false;

      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },

    getStatus() {
      if (!lastState) return null;

      const { url, ...publicState } = lastState;
      return publicState;
    }
  };
}

module.exports = {
  createActivityMonitor,
  classifyActivity,
  classifyUrl,
  domainMatches,
  IDLE_THRESHOLD_SECONDS,
  CHECK_INTERVAL_MS
};
