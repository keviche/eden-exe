const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("titlebarAPI", {
  close: () => ipcRenderer.send("titlebar:close"),
  minimize: () => ipcRenderer.send("titlebar:minimize"),
  fullscreen: () => ipcRenderer.send("titlebar:fullscreen"),
  setPlacementListener: (callback) => {
    ipcRenderer.on("titlebar:placement", (_event, placement) => {
      callback(placement);
    });
  },
});