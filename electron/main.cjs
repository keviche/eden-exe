const {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  powerMonitor,
} = require("electron");

const path = require("node:path");
const fs = require("node:fs/promises");

let mainWindow;
let titlebarWindow;

const BAR_HEIGHT = 32;
const HOVER_INTERVAL = 100;
const HIDE_DELAY = 250;

let hoverTimer;
let hideTimer;
let currentPlacement = "above";
let quitting = false;

// --------------------------------------------------
// Existing world persistence
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
    } else if (titlebarWindow.isVisible() && !hideTimer) {
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
      preload: path.join(__dirname, "titlebar-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  titlebarWindow.loadFile(
    path.join(__dirname, "titlebar.html"),
  );

  titlebarWindow.webContents.on("did-finish-load", () => {
    titlebarWindow.webContents.send(
      "titlebar:placement",
      currentPlacement,
    );
  });

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
    resizable: true,
    hasShadow: false,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setAspectRatio(width / height);

  mainWindow.on("move", syncTitlebarPosition);
  mainWindow.on("resize", syncTitlebarPosition);

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
    mainWindow.loadURL("http://127.0.0.1:5173");
  }

  createTitlebarWindow();
  startHoverMonitoring();
}

// --------------------------------------------------
// Title bar button actions
// --------------------------------------------------

ipcMain.on("titlebar:close", (event) => {
  if (event.sender !== titlebarWindow?.webContents) return;

  mainWindow?.hide();
  titlebarWindow?.hide();
});

ipcMain.on("titlebar:minimize", (event) => {
  if (event.sender !== titlebarWindow?.webContents) return;

  mainWindow?.minimize();
  titlebarWindow?.hide();
});

ipcMain.on("titlebar:fullscreen", (event) => {
  if (event.sender !== titlebarWindow?.webContents) return;

  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  titlebarWindow?.hide();
});

// --------------------------------------------------
// Application lifecycle
// --------------------------------------------------

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  quitting = true;
  stopHoverMonitoring();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});