"use strict";

// Local deterministic rules. No AI, network requests, or browsing-history storage.
const IDLE_THRESHOLD_SECONDS = 180;
const MEDIA_MAX_AGE_MS = 10_000;

const PRODUCTIVE_APPS = new Set([
  "code", "visual studio code", "visual studio code insiders", "cursor",
  "vscodium", "xcode", "terminal", "iterm2", "iterm", "warp",
  "ghostty", "kitty", "alacritty", "wezterm", "pycharm",
  "intellij idea", "webstorm", "clion", "goland", "datagrip",
  "android studio", "sublime text", "bbedit", "textedit", "vim",
  "macvim", "emacs", "zed", "r studio", "rstudio", "matlab",
  "jupyterlab", "jupyter notebook", "notion", "obsidian", "logseq",
  "bear", "one note", "onenote", "notes", "apple notes", "goodnotes",
  "notability", "evernote", "roam research", "craft", "anki",
  "preview", "skim", "pdf expert", "adobe acrobat", "adobe acrobat reader",
  "adobe reader", "zotero", "mendeley", "papers", "liquidtext",
  "microsoft word", "microsoft excel", "microsoft powerpoint",
  "microsoft onenote", "pages", "numbers", "keynote", "libreoffice",
  "figma", "figma desktop", "affinity designer", "affinity photo",
  "affinity publisher", "blender", "autocad", "fusion 360",
  "solidworks", "freecad", "postman", "insomnia", "tableplus",
  "dbeaver", "docker desktop", "github desktop", "texshop", "texstudio",
  "texmaker", "texifier", "overleaf", "scrivener", "ulysses",
  "calibre", "procreate", "miro", "microsoft teams", "zoom",
  "mail", "outlook", "microsoft outlook", "slack", "calendar",
  "reminders", "things", "todoist", "ticktick", "asana", "trello",
  "linear", "finder", "raycast", "alfred", "pdfgear", "updf",
  "foxit pdf reader", "foxit reader", "adobe acrobat reader dc",
  "jasp", "jamovi", "minitab", "stata", "ibm spss statistics",
  "mathematica", "wolfram mathematica", "tableau desktop",
]);
const PRODUCTIVE_BUNDLE_IDS = new Set([
  "com.microsoft.VSCode", "com.todesktop.230313mzl4w4u92", // Cursor (may vary)
  "com.apple.Terminal", "com.googlecode.iterm2", "com.apple.Preview",
  "com.apple.TextEdit", "com.apple.Notes", "com.apple.iWork.Pages",
  "com.apple.iWork.Numbers", "com.apple.iWork.Keynote",
  "com.microsoft.Word", "com.microsoft.Excel", "com.microsoft.Powerpoint",
  "com.adobe.Reader", "com.adobe.Acrobat.Pro", "com.skim-app.skim",
  "md.obsidian", "com.figma.Desktop", "org.zotero.zotero",
].map(value => value.toLowerCase()));
const LEISURE_APPS = new Set([
  "steam", "epic games launcher", "battle.net", "roblox", "minecraft",
  "league of legends", "valorant", "fortnite", "discord", "telegram",
  "messages", "whatsapp", "signal", "reddit", "tiktok",
  "instagram", "spotify", "music", "apple music", "tidal",
  "deezer", "soundcloud", "youtube music", "podcasts",
  "vlc", "iina", "quicktime player", "mpv", "plex",
  "infuse", "kodi", "tv", "apple tv", "netflix", "stremio",
]);
const VIDEO_APPS = new Set([
  "vlc", "iina", "quicktime player", "mpv", "plex", "infuse",
  "kodi", "tv", "apple tv", "stremio",
]);
const AUDIO_APPS = new Set([
  "spotify", "music", "apple music", "tidal", "deezer",
  "soundcloud", "youtube music", "podcasts",
]);

const PRODUCTIVE_DOMAINS = [
  "docs.google.com", "drive.google.com", "sheets.google.com",
  "slides.google.com", "notion.so", "notion.site", "obsidian.md",
  "github.com", "gitlab.com", "bitbucket.org", "stackoverflow.com",
  "stackexchange.com", "developer.mozilla.org", "developer.chrome.com",
  "docs.python.org", "pypi.org", "npmjs.com", "arxiv.org",
  "scholar.google.com", "overleaf.com", "zotero.org",
  "wikipedia.org", "wikibooks.org", "khanacademy.org",
  "coursera.org", "edx.org", "brilliant.org", "desmos.com",
  "wolframalpha.com", "wolfram.com", "leetcode.com", "hackerrank.com",
  "codeforces.com", "replit.com", "colab.research.google.com",
  "jupyter.org", "figma.com", "miro.com", "linear.app",
  "trello.com", "asana.com", "monday.com", "clickup.com",
  "airtable.com", "slack.com", "zoom.us", "teams.microsoft.com",
  "calendar.google.com", "outlook.office.com", "outlook.live.com",
  "mail.google.com", "chatgpt.com", "chat.openai.com",
  "claude.ai", "gemini.google.com", "perplexity.ai",
  "canvas.unc.edu", "unc.edu", "learn.unc.edu",
];
const LEISURE_DOMAINS = [
  "youtube.com", "youtu.be", "twitch.tv", "netflix.com",
  "disneyplus.com", "hulu.com", "max.com", "hbomax.com",
  "primevideo.com", "tv.apple.com", "peacocktv.com", "vimeo.com",
  "tubitv.com", "pluto.tv", "crunchyroll.com", "reddit.com",
  "instagram.com", "tiktok.com", "facebook.com", "x.com",
  "twitter.com", "threads.net", "pinterest.com", "tumblr.com",
  "discord.com", "spotify.com", "soundcloud.com", "tidal.com",
  "music.youtube.com", "music.apple.com", "chess.com",
  "lichess.org", "tetris.com", "itch.io", "steampowered.com",
];
const AUDIO_DOMAINS = [
  "music.youtube.com", "open.spotify.com", "music.apple.com",
  "soundcloud.com", "tidal.com", "music.amazon.com",
];

const BROWSER_NAMES = {
  "google chrome": "chrome", "chrome": "chrome", "chromium": "chrome",
  "google chrome canary": "chrome", "google chrome beta": "chrome",
  "brave browser": "brave", "brave": "brave",
  "microsoft edge": "edge", "microsoft edge beta": "edge",
  "safari": "safari", "safari technology preview": "safari",
  "firefox": "firefox", "firefox developer edition": "firefox",
  "arc": "arc", "arc browser": "arc", "opera": "opera",
  "vivaldi": "vivaldi", "orion": "orion",
};
const BROWSER_BUNDLES = {
  "com.google.chrome": "chrome", "com.google.chrome.canary": "chrome",
  "com.brave.browser": "brave", "com.microsoft.edgemac": "edge",
  "com.apple.safari": "safari", "org.mozilla.firefox": "firefox",
  "company.thebrowser.browser": "arc",
};

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function matchDomain(hostname, domain) {
  const host = normalize(hostname).replace(/\.$/, "");
  const needle = normalize(domain).replace(/\.$/, "");
  return !!needle && (host === needle || host.endsWith(`.${needle}`));
}
function hostnameFromUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.hostname.toLowerCase() : "";
  } catch {
    return "";
  }
}
function isBrowser(appName, bundleId) {
  const bundle = normalize(bundleId);
  const app = normalize(appName);
  return BROWSER_BUNDLES[bundle] || BROWSER_NAMES[app] || null;
}
function overrideMatch(overrides, kind, key) {
  const entries = overrides && typeof overrides === "object" ? overrides[kind] : null;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) return null;
  const normalizedKey = normalize(key);
  // Exact app identities, and exact or subdomain-boundary domain matching.
  const matches = Object.entries(entries)
    .filter(([candidate]) => kind === "domains"
      ? matchDomain(normalizedKey, candidate)
      : normalize(candidate) === normalizedKey)
    .sort((a, b) => b[0].length - a[0].length);
  const value = matches[0]?.[1];
  return value === "productivity" || value === "leisure" ? value : null;
}
function titleFallback(title) {
  // Only recognize product names at the end of browser titles. Never search for
  // generic words like "code" or "game" anywhere inside arbitrary titles.
  const cleaned = normalize(title)
    .replace(/\s+[-|]\s+(google chrome|brave|microsoft edge|safari|firefox|arc)$/, "");
  const suffixes = [
    ["google docs", "productivity"], ["google sheets", "productivity"],
    ["google slides", "productivity"], ["notion", "productivity"],
    ["github", "productivity"], ["gitlab", "productivity"],
    ["overleaf", "productivity"], ["figma", "productivity"],
    ["chatgpt", "productivity"], ["claude", "productivity"],
    ["youtube", "leisure"], ["netflix", "leisure"],
    ["twitch", "leisure"], ["reddit", "leisure"],
    ["instagram", "leisure"], ["tiktok", "leisure"],
    ["disney+", "leisure"], ["prime video", "leisure"],
  ];
  for (const [label, category] of suffixes) {
    if (cleaned === label || cleaned.endsWith(` - ${label}`) ||
        cleaned.endsWith(` | ${label}`)) {
      return { category, reason: "browser_title_fallback" };
    }
  }
  if (/\.pdf(?:\s+[-|]\s+.*)?$/i.test(cleaned)) {
    return { category: "productivity", reason: "pdf_title_fallback" };
  }
  return null;
}

function classifyWindow(context = {}, overrides = {}) {
  const app = normalize(context.appName);
  const bundle = normalize(context.bundleId);
  const browser = isBrowser(app, bundle);
  const hostname = browser ? hostnameFromUrl(context.url) : "";
  const videoApp = !browser && VIDEO_APPS.has(app);
  const audioOnly = !browser && AUDIO_APPS.has(app);

  if (browser) {
    // Browser-owned start pages have no meaningful site hostname. Treat the
    // explicit New Tab page as idle, while leaving other unknown URLs intact.
    const browserPage = normalize(context.url);
    const browserTitle = normalize(context.windowTitle);
    if (/^(?:chrome|brave|edge|vivaldi|opera):\/\/(?:newtab|new-tab-page|startpage)(?:[/?#].*)?$/.test(browserPage) ||
        browserPage === "about:newtab" || browserPage === "about:blank" ||
        /^(?:new tab|new tab page|new tab - .*|start page)(?:\s[-|].*)?$/.test(browserTitle)) {
      return { category: "idle", reason: "browser_new_tab", browser, hostname: "", videoApp: false, audioOnly: false };
    }
    if (hostname) {
      const custom = overrideMatch(overrides, "domains", hostname);
      if (custom) return { category: custom, reason: "custom_domain", browser, hostname, videoApp: false, audioOnly: AUDIO_DOMAINS.some(d => matchDomain(hostname, d)) };
      if (AUDIO_DOMAINS.some(d => matchDomain(hostname, d)))
        return { category: "leisure", reason: "audio_website", browser, hostname, videoApp: false, audioOnly: true };
      if (LEISURE_DOMAINS.some(d => matchDomain(hostname, d)))
        return { category: "leisure", reason: "leisure_website", browser, hostname, videoApp: false, audioOnly: false };
      if (PRODUCTIVE_DOMAINS.some(d => matchDomain(hostname, d)))
        return { category: "productivity", reason: "productive_website", browser, hostname, videoApp: false, audioOnly: false };
      if (["localhost", "127.0.0.1", "::1"].includes(hostname))
        return { category: "productivity", reason: "local_development", browser, hostname, videoApp: false, audioOnly: false };
      try {
        if (/\.pdf$/i.test(new URL(context.url).pathname))
          return { category: "productivity", reason: "pdf_file", browser, hostname, videoApp: false, audioOnly: false };
      } catch { /* The hostname was already validated. */ }
      return { category: "leisure", reason: "unknown_website", browser, hostname, videoApp: false, audioOnly: false };
    }
    // Unknown browser URL: conservative title fallback, never keyword search.
    if (typeof context.url === "string" && context.url.startsWith("file:") && /\.pdf(?:$|[?#])/i.test(context.url))
      return { category: "productivity", reason: "local_pdf", browser, hostname, videoApp: false, audioOnly: false };
    const fallback = titleFallback(context.windowTitle);
    return { ...(fallback || { category: "leisure", reason: "unknown_browser_tab" }), browser, hostname, videoApp: false, audioOnly: false };
  }

  const custom = overrideMatch(overrides, "apps", bundle) || overrideMatch(overrides, "apps", app);
  if (custom) return { category: custom, reason: "custom_app", browser: null, hostname: "", videoApp, audioOnly };
  if (PRODUCTIVE_BUNDLE_IDS.has(bundle) || PRODUCTIVE_APPS.has(app))
    return { category: "productivity", reason: "productive_app", browser: null, hostname: "", videoApp, audioOnly };
  if (LEISURE_APPS.has(app))
    return { category: "leisure", reason: audioOnly ? "audio_app" : videoApp ? "video_app" : "leisure_app", browser: null, hostname: "", videoApp, audioOnly };
  return { category: "leisure", reason: "unclassified_app", browser: null, hostname: "", videoApp: false, audioOnly: false };
}

function matchVideoEvidence(classification, context, media, now) {
  if (!media || media.playing !== true || classification.audioOnly || !classification.browser) return false;
  if (!["chrome", "brave", "edge"].includes(classification.browser)) return false;
  if (media.browser !== classification.browser || !Number.isFinite(media.at) ||
      now - media.at < 0 || now - media.at > MEDIA_MAX_AGE_MS) return false;
  const foreground = normalize(context.windowTitle)
    .replace(/\s+[-|]\s+(google chrome|brave|microsoft edge)$/, "");
  const reported = normalize(media.title);
  const titleMatches = !!reported && reported.length >= 8 &&
    (foreground === reported || foreground.startsWith(`${reported} - `) ||
      foreground.endsWith(` - ${reported}`));
  if (classification.hostname) {
    // Exact browser hostname plus title check avoids counting an old video's
    // heartbeat after the active tab navigates elsewhere on the same site.
    return matchDomain(classification.hostname, media.hostname) &&
      matchDomain(media.hostname, classification.hostname) &&
      (!foreground || titleMatches);
  }
  // active-win sometimes omits browser URLs in packaged macOS builds.
  return titleMatches;
}

function decideActivity(input = {}, overrides = {}) {
  const idleSeconds = Number.isFinite(input.idleSeconds) ? Math.max(0, input.idleSeconds) : 0;
  const currentTime = Number.isFinite(input.now) ? input.now : Date.now();
  const systemState = input.systemState || "active";
  const classification = classifyWindow(input, overrides);
  const isLocked = systemState === "locked" || systemState === "suspended";
  const physicallyIdle = idleSeconds >= IDLE_THRESHOLD_SECONDS || systemState === "idle";

  if (isLocked) return { status: "idle", category: "idle", reason: "screen_locked", classification };
  if (physicallyIdle) {
    if (classification.videoApp)
      return { status: "active", category: "leisure", reason: "foreground_video_player_heuristic", classification };
    if (matchVideoEvidence(classification, input, input.media, currentTime))
      return { status: "active", category: "leisure", reason: "verified_browser_video", classification };
    return { status: "idle", category: "idle", reason: "afk", classification };
  }
  return { status: "active", category: classification.category, reason: classification.reason, classification };
}

module.exports = {
  IDLE_THRESHOLD_SECONDS,
  MEDIA_MAX_AGE_MS,
  classifyWindow,
  decideActivity,
  matchDomain,
  hostnameFromUrl,
  isBrowser,
};
