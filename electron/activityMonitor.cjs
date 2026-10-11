
const { powerMonitor } = require("electron");

const IDLE_THRESHOLD_SECONDS = 300;
const CHECK_INTERVAL_MS = 1000;

function createActivityMonitor(onStatusChange) {
  let intervalId = null;
  let currentStatus = null;

  function checkActivity() {
    const idleSeconds = powerMonitor.getSystemIdleTime();

    const newStatus =
      idleSeconds >= IDLE_THRESHOLD_SECONDS
        ? "idle"
        : "active";

    // Only report when the status actually changes.
    if (newStatus !== currentStatus) {
      currentStatus = newStatus;

      onStatusChange({
        status: newStatus,
        idleSeconds,
        timestamp: Date.now(),
      });
    }
  }

  return {
    start() {
      if (intervalId !== null) {
        return;
      }

      // Check immediately on startup.
      checkActivity();

      // Then check every second.
      intervalId = setInterval(
        checkActivity,
        CHECK_INTERVAL_MS,
      );
    },

    stop() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },

    getStatus() {
      return currentStatus;
    },
  };
}

module.exports = {
  createActivityMonitor,
  IDLE_THRESHOLD_SECONDS,
};
