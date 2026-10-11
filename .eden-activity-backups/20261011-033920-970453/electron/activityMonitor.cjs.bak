const { powerMonitor } = require("electron");

const IDLE_THRESHOLD_SECONDS = 300;
const CHECK_INTERVAL_MS = 2000;

let activeWin = null;

async function initActiveWin() {
  if (!activeWin) {
    try {
      activeWin = (await import("active-win")).default;
    } catch (err) {
      console.error("[EDEN] Failed to load active-win:", err);
    }
  }
}

function classifyActivity(appName, windowTitle) {
  const app = (appName || "").toLowerCase();
  const title = (windowTitle || "").toLowerCase();

  const productivityKeywords = ["code", "cursor", "terminal", "xcode", "figma", "notion", "word", "excel", "docs", "postman"];
  const leisureKeywords = ["steam", "spotify", "discord", "netflix", "twitch", "vlc", "game", "reddit"];
  const leisureSites = ["youtube", "twitch", "reddit", "netflix", "twitter", "x.com"];

  if (productivityKeywords.some(keyword => app.includes(keyword) || title.includes(keyword))) {
    return "productivity";
  }
  if (leisureKeywords.some(keyword => app.includes(keyword) || title.includes(keyword)) ||
      leisureSites.some(site => title.includes(site))) {
    return "leisure";
  }
  return "productivity"; // Default active category fallback
}

function createActivityMonitor(onStatusChange) {
  let intervalId = null;
  let lastState = null;

  async function checkActivity() {
    await initActiveWin();
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const isSystemIdle = idleSeconds >= IDLE_THRESHOLD_SECONDS;

    let appName = "";
    let windowTitle = "";
    let category = "productivity";

    if (activeWin) {
      try {
        const winInfo = await activeWin();
        if (winInfo && winInfo.owner) {
          appName = winInfo.owner.name;
          windowTitle = winInfo.title || "";
          category = classifyActivity(appName, windowTitle);
        }
      } catch (err) {
        // Handle window polling errors silently
      }
    }

    const newStatus = isSystemIdle ? "idle" : "active";
    
    // Trigger update if status or active app/title context changes
    if (
      !lastState ||
      lastState.status !== newStatus ||
      lastState.windowTitle !== windowTitle ||
      lastState.appName !== appName
    ) {
      lastState = {
        status: newStatus,
        category: isSystemIdle ? "idle" : category,
        idleSeconds,
        appName,
        windowTitle,
        timestamp: Date.now(),
      };

      onStatusChange(lastState);
    }
  }

  return {
    start() {
      if (intervalId !== null) return;
      checkActivity();
      intervalId = setInterval(checkActivity, CHECK_INTERVAL_MS);
    },
    stop() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    getStatus() {
      return lastState;
    },
  };
}

module.exports = {
  createActivityMonitor,
  IDLE_THRESHOLD_SECONDS,
};