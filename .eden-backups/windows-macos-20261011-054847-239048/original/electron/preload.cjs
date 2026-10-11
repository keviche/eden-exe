const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("edenAPI", {
  // Existing world persistence
  loadWorld: () => ipcRenderer.invoke("world:load"),

  saveWorld: (world) =>
    ipcRenderer.invoke("world:save", world),

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