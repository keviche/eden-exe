const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");

let mainWindow;


function getWorldSavePath() {
  return path.join(app.getPath("userData"), "world.json");
}

// Load the saved world from disk.
ipcMain.handle("world:load", async () => {
  try {
    const contents = await fs.readFile(getWorldSavePath(), "utf8");
    return JSON.parse(contents);
  } catch (error) {
    // No save file exists yet.
    if (error.code === "ENOENT") {
      return null;
    }

    // Other errors should be visible to the caller.
    throw error;
  }
});

// Save the world to disk.
ipcMain.handle("world:save", async (_event, world) => {
  const savePath = getWorldSavePath();
  const temporaryPath = `${savePath}.tmp`;

  // Write to a temporary file first to reduce the
  // chance of corrupting the existing save.
  await fs.writeFile(
    temporaryPath,
    JSON.stringify(world, null, 2),
    "utf8",
  );

  await fs.rename(temporaryPath, savePath);

  return true;
});


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
