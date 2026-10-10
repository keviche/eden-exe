const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("edenAPI", {
  loadWorld: () => ipcRenderer.invoke("world:load"),
  saveWorld: (world) => ipcRenderer.invoke("world:save", world),
});
