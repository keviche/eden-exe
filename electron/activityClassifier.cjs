// Productivity allowlist with strict word boundaries and explicit exclusions
const PRODUCTIVITY_APP_PATTERN = /\b(code|vscode|visual studio code|visual studio|intellij|webstorm|pycharm|rider|xcode|terminal|powershell|command prompt|windows terminal|iterm|warp|word|excel|powerpoint|outlook|onenote|figma|postman|insomnia|jira|confluence|notion|slack|teams|zoom)\b/i;
const PRODUCTIVITY_TITLE_PATTERN = /\b(code|vs\s?code|visual studio|intellij|webstorm|pycharm|xcode|terminal|powershell|command prompt|\.tsx?|\.jsx?|\.py|\.rs|\.go|\.java|\.cpp|\.h|\.cs|\.json|\.md|\.html|\.css|\.sql|pull request|code review|postman collection|google docs|google sheets|google slides|microsoft word|microsoft excel|microsoft powerpoint|jira|confluence|figma|notion|outlook|teams|slack)\b/i;

// Explicit blacklist for apps that should ALWAYS be leisure (e.g. games, launchers)
const LEISURE_BLACKLIST_PATTERN = /\b(steam|discord|epicgameslauncher|spotify|twitch|netflix|vlc)\b/i;

function classifyActivity(appName = "", windowTitle = "") {
  const app = String(appName || "").toLowerCase();
  const title = String(windowTitle || "").toLowerCase();
  
  // If it's explicitly blacklisted, it's leisure regardless of anything else
  if (LEISURE_BLACKLIST_PATTERN.test(app) || LEISURE_BLACKLIST_PATTERN.test(title)) {
    return "leisure";
  }

  if (PRODUCTIVITY_APP_PATTERN.test(app) || PRODUCTIVITY_TITLE_PATTERN.test(title)) {
    return "productivity";
  }
  return "leisure";
}

module.exports = { classifyActivity };