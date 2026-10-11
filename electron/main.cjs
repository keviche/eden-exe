const {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  shell, clipboard, Tray, Menu, nativeImage,
} = require("electron");

const { createActivityMonitor } = require("./activityMonitor.cjs");
const { createMediaBridge } = require("./mediaBridge.cjs");

const path = require("node:path");
const fs = require("node:fs/promises");

let mainWindow;
let titlebarWindow;
let tray = null;

const BAR_HEIGHT = 32;
const HOVER_INTERVAL = 100;
const HIDE_DELAY = 250;

let hoverTimer;
let hideTimer;
let currentPlacement = "above";
let quitting = false;

// --------------------------------------------------
// World persistence
// --------------------------------------------------

function getWorldSavePath() {
  return path.join(app.getPath("userData"), "world.json");
}

ipcMain.handle("world:load", async () => {
  try {
    const contents = await fs.readFile(getWorldSavePath(), "utf8");
    return JSON.parse(contents);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
});

ipcMain.handle("world:save", async (_event, world) => {
  const savePath = getWorldSavePath();
  const temporaryPath = `${savePath}.tmp`;

  await fs.writeFile(
    temporaryPath,
    JSON.stringify(world, null, 2),
    "utf8",
  );

  await fs.rename(temporaryPath, savePath);

  return true;
});

// --------------------------------------------------
// Activity monitoring and IPC
// --------------------------------------------------

// Stores the latest system-wide activity status.
// Example:
// {
//   status: "active",
//   idleSeconds: 0,
//   timestamp: 1720000000000
// }

let latestActivity = null;

function getRulesPath() {
  return path.join(app.getPath("userData"), "activity-rules.json");
}
async function ensureRulesFile() {
  const filename = getRulesPath();
  await fs.mkdir(path.dirname(filename), { recursive: true });
  try {
    await fs.writeFile(filename, JSON.stringify({ apps: {}, domains: {} }, null, 2) + "\n", { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  return filename;
}

// The local HTTP bridge is accessible to the paired Chrome/Edge/Brave extension.
// It never sends data to a remote service and keeps only the latest tab sample.
let activityMonitor;
const mediaBridge = createMediaBridge(() => activityMonitor?.refresh());
activityMonitor = createActivityMonitor(activity => {
  latestActivity = activity;
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send("activity:changed", activity);
  }
}, {
  mediaBridge,
  rulesPath: getRulesPath(),
  windowsScriptPath: app.isPackaged
    ? path.join(process.resourcesPath, "windowsForeground.ps1")
    : path.join(__dirname, "windowsForeground.ps1"),
});

function fromMainRenderer(event) {
  return !!mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;
}
ipcMain.handle("activity:get-current", event => fromMainRenderer(event) ? latestActivity : null);
ipcMain.handle("media:copy-pairing-key", event => {
  if (!fromMainRenderer(event)) return false;
  const key = mediaBridge.getPairingCode();
  if (!key) return false;
  clipboard.writeText(key);
  return true;
});
ipcMain.handle("browser:show-extension-folder", event => {
  if (!fromMainRenderer(event)) return false;
  const filename = app.isPackaged
    ? path.join(process.resourcesPath, "browser-extension", "manifest.json")
    : path.join(__dirname, "..", "browser-extension", "manifest.json");
  shell.showItemInFolder(filename);
  return true;
});
ipcMain.handle("activity:show-rules-file", async event => {
  if (!fromMainRenderer(event)) return false;
  const filename = await ensureRulesFile();
  shell.showItemInFolder(filename); // Finder on macOS, Explorer on Windows
  return true;
});

// --------------------------------------------------
// Title bar positioning
// --------------------------------------------------

function getTitlebarBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  const bounds = mainWindow.getBounds();

  return {
    bounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: BAR_HEIGHT,
    },
    placement: "above",
  };
}

function syncTitlebarPosition() {
  if (!titlebarWindow || titlebarWindow.isDestroyed()) {
    return false;
  }

  const result = getTitlebarBounds();

  if (!result) {
    titlebarWindow.hide();
    return false;
  }

  titlebarWindow.setBounds(result.bounds);

  if (currentPlacement !== result.placement) {
    currentPlacement = result.placement;

    titlebarWindow.webContents.send(
      "titlebar:placement",
      currentPlacement,
    );
  }

  return true;
}

// --------------------------------------------------
// Hover detection
// --------------------------------------------------

function pointInside(bounds, point) {
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
}

function stopHoverMonitoring() {
  if (hoverTimer) {
    clearInterval(hoverTimer);
    hoverTimer = null;
  }

  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function startHoverMonitoring() {
  stopHoverMonitoring();

  hoverTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    if (!titlebarWindow || titlebarWindow.isDestroyed()) {
      return;
    }

    if (
      !mainWindow.isVisible() ||
      mainWindow.isMinimized() ||
      mainWindow.isFullScreen()
    ) {
      titlebarWindow.hide();
      return;
    }

    const cursor = screen.getCursorScreenPoint();

    const overMain = pointInside(
      mainWindow.getBounds(),
      cursor,
    );

    const overTitlebar =
      titlebarWindow.isVisible() &&
      pointInside(titlebarWindow.getBounds(), cursor);

    if (overMain || overTitlebar) {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }

      if (!titlebarWindow.isVisible()) {
        if (syncTitlebarPosition()) {
          titlebarWindow.showInactive();
        }
      }
    } else if (
      titlebarWindow.isVisible() &&
      !hideTimer
    ) {
      hideTimer = setTimeout(() => {
        hideTimer = null;

        if (
          titlebarWindow &&
          !titlebarWindow.isDestroyed()
        ) {
          titlebarWindow.hide();
        }
      }, HIDE_DELAY);
    }
  }, HOVER_INTERVAL);
}

// --------------------------------------------------
// Title bar window
// --------------------------------------------------

function createTitlebarWindow() {
  titlebarWindow = new BrowserWindow({
    parent: mainWindow,
    width: 500,
    height: BAR_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,

    webPreferences: {
      preload: path.join(
        __dirname,
        "titlebar-preload.cjs",
      ),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  titlebarWindow.loadFile(
    path.join(__dirname, "titlebar.html"),
  );
  titlebarWindow.setAlwaysOnTop(true);

  titlebarWindow.webContents.on(
    "did-finish-load",
    () => {
      titlebarWindow.webContents.send(
        "titlebar:placement",
        currentPlacement,
      );
    },
  );

  titlebarWindow.on("closed", () => {
    titlebarWindow = null;
  });
}

// --------------------------------------------------
// Main window
// --------------------------------------------------

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  const width = 500;
  const height = 350;

  mainWindow = new BrowserWindow({
    width,
    height,

    x: workArea.x + workArea.width - width - 20,
    y: workArea.y + workArea.height - height - 20,

    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    // Electron warns that resizable transparent windows may lose transparency
    // on Windows. Keep the macOS behavior unchanged.
    resizable: process.platform !== "win32",
    hasShadow: false,

    webPreferences: {
      preload: path.join(
        __dirname,
        "preload.cjs",
      ),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });


  mainWindow.on("move", syncTitlebarPosition);
  mainWindow.on("resize", syncTitlebarPosition);
  mainWindow.on("show", () => {
    syncTitlebarPosition();
  });

  mainWindow.on("hide", () => {
    titlebarWindow?.hide();
  });

  mainWindow.on("minimize", () => {
    titlebarWindow?.hide();
  });

  mainWindow.on("enter-full-screen", () => {
    titlebarWindow?.hide();
  });

  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();

      mainWindow.hide();
      titlebarWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (app.isPackaged) {
    mainWindow.loadFile(
      path.join(__dirname, "../dist/index.html"),
    );
  } else {
    mainWindow.loadURL(
      "http://127.0.0.1:5173",
    );
  }

  createTitlebarWindow();
  startHoverMonitoring();
}

// --------------------------------------------------

// --------------------------------------------------
// Move the main window when dragging the toolbar.
// --------------------------------------------------

let toolbarDrag = null;
let toolbarDragTimer = null;

function stopToolbarDrag() {
  if (toolbarDragTimer) {
    clearInterval(toolbarDragTimer);
    toolbarDragTimer = null;
  }
  toolbarDrag = null;
}

ipcMain.on("titlebar:drag-start", (event) => {
  if (
    event.sender !== titlebarWindow?.webContents ||
    !mainWindow ||
    mainWindow.isDestroyed() ||
    mainWindow.isFullScreen()
  ) return;

  stopToolbarDrag();

  const cursor = screen.getCursorScreenPoint();
  const bounds = mainWindow.getBounds();

  toolbarDrag = {
    offsetX: cursor.x - bounds.x,
    offsetY: cursor.y - bounds.y,
  };

  toolbarDragTimer = setInterval(() => {
    if (
      !toolbarDrag ||
      !mainWindow ||
      mainWindow.isDestroyed()
    ) {
      stopToolbarDrag();
      return;
    }

    const point = screen.getCursorScreenPoint();

    const x = Math.round(point.x - toolbarDrag.offsetX);
    const y = Math.round(point.y - toolbarDrag.offsetY);

    const [currentX, currentY] = mainWindow.getPosition();

    if (x !== currentX || y !== currentY) {
      mainWindow.setPosition(x, y);
      syncTitlebarPosition();
    }
  }, 16);
});

ipcMain.on("titlebar:drag-end", (event) => {
  if (event.sender !== titlebarWindow?.webContents) return;
  stopToolbarDrag();
});

// Title bar button actions
// --------------------------------------------------

ipcMain.on("titlebar:close", (event) => {
  if (
    event.sender !== titlebarWindow?.webContents
  ) {
    return;
  }

  mainWindow?.hide();
  titlebarWindow?.hide();
});

ipcMain.on("titlebar:minimize", (event) => {
  if (
    event.sender !== titlebarWindow?.webContents
  ) {
    return;
  }

  mainWindow?.minimize();
  titlebarWindow?.hide();
});

ipcMain.on("titlebar:fullscreen", (event) => {
  if (
    event.sender !== titlebarWindow?.webContents
  ) {
    return;
  }

  if (
    !mainWindow ||
    mainWindow.isDestroyed()
  ) {
    return;
  }

  mainWindow.setFullScreen(
    !mainWindow.isFullScreen(),
  );

  titlebarWindow?.hide();
});

// --------------------------------------------------
// Windows close-to-tray support: without it, closing the frameless window
// leaves an invisible activity monitor that cannot be reopened.
function showFromTray() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  else { mainWindow.show(); mainWindow.focus(); }
}
function createWindowsTray() {
  if (tray) return;
  const icon = path.join(__dirname, "tray.png");
  try {
    const picture = nativeImage.createFromPath(icon);
    if (picture.isEmpty()) throw new Error("Tray icon not found");
    tray = new Tray(picture);
    tray.setToolTip("Eden.exe - desktop terrarium");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Show Eden.exe", click: showFromTray },
      { label: "Quit Eden.exe", click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on("double-click", showFromTray);
  } catch (error) {
    console.warn("[EDEN] Windows tray unavailable:", error.message);
  }
}

// Application lifecycle
// --------------------------------------------------

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.edenexe.desktop");
  }
  createWindow();
  if (process.platform === "win32") createWindowsTray();

  void ensureRulesFile().catch(error => console.warn("[EDEN] Rules file:", error.message));
  void mediaBridge.start(app.getPath("userData")).catch(error => {
    console.warn("[EDEN] Local browser bridge unavailable:", error.message);
  });
  activityMonitor.start();

  app.on("activate", () => {
    if (
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  quitting = true;

  stopHoverMonitoring();

  // Stop the activity polling interval.
  activityMonitor.stop();
  void mediaBridge.stop();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
