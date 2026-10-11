/* global chrome */
(() => {
  "use strict";
  // Watches only <video> elements. Audio-only playback never prevents AFK.
  // No click/keyboard monitoring, screenshots, history, or media metadata.
  const currentState = () => Array.from(document.querySelectorAll("video")).some(video =>
    !video.paused && !video.ended && video.readyState >= 2 &&
    video.videoWidth > 0 && video.videoHeight > 0 && video.playbackRate !== 0
  );

  let previous = null;
  function report(force = false) {
    const playing = currentState();
    if (!force && playing === previous) return;
    previous = playing;
    try {
      chrome.runtime.sendMessage({ type: "EDEN_VIDEO_STATE", playing }).catch(() => {});
    } catch { /* Extension may have been reloaded. */ }
  }

  for (const event of ["play", "playing", "pause", "ended", "emptied", "loadedmetadata", "ratechange"]) {
    document.addEventListener(event, () => report(), true);
  }
  // A periodic heartbeat also handles video nodes added by streaming apps.
  // Chrome may throttle inactive tabs; stale reports expire automatically.
  setInterval(() => report(true), 3000);
  report(true);
})();
