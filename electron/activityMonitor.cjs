const { powerMonitor } = require("electron");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const IDLE_THRESHOLD_SECONDS = 10;
const CHECK_INTERVAL_MS = 2000;
const CHROME_URL_TIMEOUT_MS = 1500;

// Unknown websites are tracked internally as "unknown".
// For compatibility with the existing EDEN.EXE city simulation,
// unknown currently maps to "leisure" in the public activity event.
const UNKNOWN_PUBLIC_FALLBACK = "leisure";

// Customize these overrides to suit your workflow.
// Exact domains and their subdomains are supported.
//
// Examples:
// "youtube.com": "productivity",
// "reddit.com": "productivity",
// "example.com": "leisure"
const DOMAIN_OVERRIDES = Object.freeze({
});

// Application overrides take precedence over built-in rules.
const APP_OVERRIDES = Object.freeze({
});

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

const CHROMIUM_BROWSERS = Object.freeze({
  "google chrome": "Google Chrome",
  "chrome": "Google Chrome",
  "brave browser": "Brave Browser",
  "brave": "Brave Browser",
  "microsoft edge": "Microsoft Edge"
});

// Clear-cut productivity domains.
// These cover AI tools, programming, documents,
// education, research, and common collaboration tools.
const PRODUCTIVITY_DOMAINS = [
  "mail.google.com",
  // AI assistants and development
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "gemini.google.com",
  "perplexity.ai",
  "copilot.microsoft.com",
  "aistudio.google.com",
  "huggingface.co",
  "poe.com",
  "chat.deepseek.com",
  "grok.com",
  "notebooklm.google.com",
  "cursor.com",
  "replit.com",
  "lovable.dev",
  "bolt.new",
  "v0.app",
  "v0.dev",

  // Programming and development
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "stackoverflow.com",
  "stackexchange.com",
  "leetcode.com",
  "hackerrank.com",
  "codeforces.com",
  "codewars.com",
  "geeksforgeeks.org",
  "w3schools.com",
  "developer.mozilla.org",
  "dev.to",
  "freecodecamp.org",
  "exercism.org",
  "codepen.io",
  "jsfiddle.net",
  "npmjs.com",
  "pypi.org",
  "hub.docker.com",
  "vercel.com",
  "netlify.com",
  "console.aws.amazon.com",
  "console.cloud.google.com",
  "portal.azure.com",

  // Documents and office work
  "docs.google.com",
  "sheets.google.com",
  "slides.google.com",
  "drive.google.com",
  "microsoft365.com",
  "office.com",
  "word.cloud.microsoft",
  "excel.cloud.microsoft",
  "powerpoint.cloud.microsoft",
  "notion.so",
  "notion.site",
  "coda.io",
  "dropbox.com",
  "onedrive.live.com",
  "grammarly.com",
  "overleaf.com",
  "quip.com",
  "writer.zoho.com",
  "acrobat.adobe.com",

  // School and research
  "instructure.com",
  "blackboard.com",
  "blackboardlearn.com",
  "classroom.google.com",
  "khanacademy.org",
  "coursera.org",
  "edx.org",
  "ocw.mit.edu",
  "brilliant.org",
  "quizlet.com",
  "ankiweb.net",
  "scholar.google.com",
  "arxiv.org",
  "jstor.org",
  "pubmed.ncbi.nlm.nih.gov",
  "researchgate.net",
  "semanticscholar.org",
  "wolframalpha.com",
  "desmos.com",
  "geogebra.org",

  // Project management and collaboration
  "trello.com",
  "asana.com",
  "atlassian.net",
  "linear.app",
  "clickup.com",
  "monday.com",
  "airtable.com",
  "basecamp.com",
  "miro.com",
  "figma.com",
  "app.slack.com",
  "teams.microsoft.com",
  "zoom.us",
  "meet.google.com",
  "calendly.com",
  "calendar.google.com",

  "wikipedia.org",
  "wiktionary.org",
  "britannica.com",
  "encyclopedia.com",
  "merriam-webster.com",
  "dictionary.com",
  "dictionary.cambridge.org",
  "oxfordlearnersdictionaries.com",
  "oed.com",
  "collinsdictionary.com",
  "ldoceonline.com",
  "wordreference.com",
  "thefreedictionary.com",
  "vocabulary.com",
  "thesaurus.com",
  "wordnik.com",
  "onelook.com",
  "yourdictionary.com",
  "dictionary.langeek.co",
  "linguee.com",
  "reverso.net",
  "deepl.com",
  "translate.google.com",
];

// Clear-cut entertainment and gaming domains.
const LEISURE_DOMAINS = [
  // Video streaming
  "youtube.com",
  "youtu.be",
  "netflix.com",
  "hulu.com",
  "disneyplus.com",
  "primevideo.com",
  "twitch.tv",
  "kick.com",
  "crunchyroll.com",
  "hbomax.com",
  "max.com",
  "peacocktv.com",
  "paramountplus.com",
  "tv.apple.com",
  "tubitv.com",
  "pluto.tv",

  // Gaming
  "store.steampowered.com",
  "steamcommunity.com",
  "epicgames.com",
  "roblox.com",
  "minecraft.net",
  "crazygames.com",
  "poki.com",
  "coolmathgames.com",
  "itch.io",
  "kongregate.com",
  "newgrounds.com",
  "chess.com",
  "lichess.org",
  "geoguessr.com",
  "fortnite.com",
  "ign.com",
  "gamespot.com",

  // Music and podcasts
  "open.spotify.com",
  "music.apple.com",
  "soundcloud.com",
  "music.youtube.com",
  "pandora.com",
  "bandcamp.com",
  "tidal.com",
  "deezer.com",
  "iheart.com",
  "audible.com"
];

// Context-dependent websites are intentionally not classified
// as inherently productive or leisurely.
const AMBIGUOUS_DOMAINS = [
  "reddit.com",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "threads.net",
  "threads.com",
  "snapchat.com",
  "pinterest.com",
  "tumblr.com",
  "discord.com",
  "bsky.app",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "joinhandshake.com",
  "wellfound.com",
  "simplify.jobs",
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "amazon.com",
  "ebay.com",
  "etsy.com",
  "walmart.com",
  "target.com",
  "canva.com",

  "google.com",
  "bing.com",
  "duckduckgo.com",
  "cnn.com",
  "bbc.com",
  "nytimes.com",
  "espn.com",
  "nba.com",
  "nfl.com",
  "mlb.com",
  "bloomberg.com",
  "tradingview.com",
  "finance.yahoo.com"
];

function normalize(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\s+/g, " ")
    : "";
}

function domainMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith("." + domain);
}

function matchDomain(hostname, domains) {
  return domains.some(domain => domainMatches(hostname, domain));
}

function classifyUrl(url) {
  if (!url || typeof url !== "string") return "unknown";

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return "unknown";
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return "unknown";
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");

  // User overrides take highest priority.
  const override = Object.entries(DOMAIN_OVERRIDES)
    .filter(([domain]) => domainMatches(hostname, domain))
    .sort((a, b) => b[0].length - a[0].length)[0];

  if (override) return override[1];

  // More specific domain rules take priority.
  // For example, music.youtube.com is Leisure.
  if (matchDomain(hostname, LEISURE_DOMAINS)) {
    return "leisure";
  }

  if (matchDomain(hostname, PRODUCTIVITY_DOMAINS)) {
    return "productivity";
  }

  if (matchDomain(hostname, AMBIGUOUS_DOMAINS)) {
    return "unknown";
  }

  return "unknown";
}

function classifyActivity(appName, windowTitle, url = "") {
  const app = normalize(appName);
  const title = normalize(windowTitle);

  if (Object.hasOwn(APP_OVERRIDES, app)) {
    return APP_OVERRIDES[app];
  }

  if (PRODUCTIVITY_APPS.has(app)) return "productivity";
  if (LEISURE_APPS.has(app)) return "leisure";

  if (BROWSERS.has(app)) {
    if (url) {
      // A known URL is more reliable than the tab title.
      return classifyUrl(url);
    }

    // When URL retrieval is unavailable, recognize only
    // highly distinctive site names.
    const productivityTitles = [
      "gmail",
      "chatgpt",
      "claude",
      "gemini",
      "perplexity",
      "github",
      "gitlab",
      "leetcode",
      "google docs",
      "google sheets",
      "google slides",
      "notion",
      "figma",
      "overleaf",
      "wikipedia",
      "wiktionary",
      "britannica",
      "merriam-webster",
      "dictionary.com",
      "cambridge dictionary",
      "oxford learner",
      "oxford english dictionary",
      "collins dictionary",
      "longman dictionary",
      "wordreference",
      "the free dictionary",
      "vocabulary.com",
      "thesaurus.com",
      "wordnik",
      "deepl translator",
      "google translate",
];

    const leisureTitles = [
      "youtube",
      "netflix",
      "twitch",
      "spotify",
      "crunchyroll",
      "prime video"
    ];

    const hasPhrase = (phrase) => {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(
        "(^|[^a-z0-9])" + escaped + "(?=$|[^a-z0-9])",
        "i"
      ).test(title);
    };

    if (leisureTitles.some(hasPhrase)) return "leisure";
    if (productivityTitles.some(hasPhrase)) return "productivity";

    return "unknown";
  }

  return "unknown";
}

async function getActiveChromeUrl(appName) {
  const browser = CHROMIUM_BROWSERS[normalize(appName)];

  if (!browser || process.platform !== "darwin") return "";

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
    return "";
  }
}

let activeWin = null;
let activeWinLoadAttempted = false;

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
      let category = "unknown";
      let url = "";

      if (!isIdle) {
        await initActiveWin();

        if (activeWin) {
          try {
            const info = await activeWin();

            if (info?.owner) {
              appName = info.owner.name || "";
              windowTitle = info.title || "";

              if (CHROMIUM_BROWSERS[normalize(appName)]) {
                url = await getActiveChromeUrl(appName);
              }

              category = classifyActivity(appName, windowTitle, url);

              // Avoid temporary category changes when Chrome
              // exposes an empty title during tab switching.
              if (
                BROWSERS.has(normalize(appName)) &&
                !windowTitle.trim() &&
                !url &&
                lastState?.status === "active" &&
                lastState.appName === appName
              ) {
                category = lastState.rawCategory;
              }
            }
          } catch {
            if (lastState?.status === "active") {
              category = lastState.rawCategory;
            }
          }
        }
      }

      if (!running) return;

      const status = isIdle ? "idle" : "active";
      const rawCategory = isIdle ? "idle" : category;
      const publicCategory =
        rawCategory === "unknown"
          ? UNKNOWN_PUBLIC_FALLBACK
          : rawCategory;

      const changed =
        !lastState ||
        lastState.status !== status ||
        lastState.category !== publicCategory ||
        lastState.rawCategory !== rawCategory ||
        lastState.appName !== appName ||
        lastState.windowTitle !== windowTitle;

      if (!changed) return;

      lastState = {
        status,
        category: publicCategory,
        rawCategory,
        idleSeconds,
        appName,
        windowTitle,
        timestamp: Date.now()
      };

      onStatusChange({
        status,
        category: publicCategory,
        idleSeconds,
        appName,
        windowTitle,
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

      const { rawCategory, ...publicState } = lastState;
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
