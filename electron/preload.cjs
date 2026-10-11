const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("edenAPI", {
  // Existing world persistence
  loadWorld: () => ipcRenderer.invoke("world:load"),

  saveWorld: (world) =>
    ipcRenderer.invoke("world:save", world),

  // Optional local companion setup, only available to Eden's own renderer.
  copyBrowserPairingKey: () => ipcRenderer.invoke("media:copy-pairing-key"),
  showActivityRulesFile: () => ipcRenderer.invoke("activity:show-rules-file"),
  showBrowserExtensionFolder: () => ipcRenderer.invoke("browser:show-extension-folder"),

  // Get the current system activity status
  getCurrentActivity: () =>
    ipcRenderer.invoke("activity:get-current"),

  // Listen for system activity changes
  onActivityChanged: (callback) => {
    const listener = (_event, activity) => {
      callback(activity);
    };

    ipcRenderer.on("activity:changed", listener);

    // Return a cleanup function
    return () => {
      ipcRenderer.removeListener(
        "activity:changed",
        listener
      );
    };
  },
});