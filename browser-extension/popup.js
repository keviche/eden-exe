/* global chrome */
const input = document.getElementById("token");
const browser = document.getElementById("browser");
const status = document.getElementById("status");
chrome.storage.local.get(["pairingCode", "browser"]).then(data => {
  input.value = data.pairingCode || "";
  browser.value = data.browser || "chrome";
});
document.getElementById("save").addEventListener("click", async () => {
  const pairingCode = input.value.trim();
  if (!/^[a-f0-9]{64}$/.test(pairingCode)) {
    status.textContent = "Invalid key. Copy the complete key from Eden.exe.";
    return;
  }
  await chrome.storage.local.set({ pairingCode, browser: browser.value });
  status.textContent = "Paired locally. Play a video in the foreground and keep Eden running.";
});
