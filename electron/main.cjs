const { app, BrowserWindow, screen } = require("electron");
const path = require("node:path");

let mainWindow;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  const width = 500;
  const height = 350;

  mainWindow = new BrowserWindow({
    width,
    height,

    // Position EDEN.EXE near the bottom-left corner
    x: workArea.x + 20,
    y: workArea.y + workArea.height - height - 20,

    // Desktop companion appearance
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (app.isPackaged) {
    // Load the compiled React application
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    // Load the Vite development server
    mainWindow.loadURL("http://127.0.0.1:5173");
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});