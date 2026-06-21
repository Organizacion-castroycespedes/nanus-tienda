import { app, BrowserWindow, shell } from "electron";
import path from "node:path";

const DEFAULT_WEB_URL = "http://localhost:3000";
const DEFAULT_WINDOW_TITLE = "Manus POS";
const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 800;
const MIN_WINDOW_WIDTH = 1024;
const MIN_WINDOW_HEIGHT = 700;
const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

type CloseBehavior = "quit" | "hide";

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseCloseBehavior = (value: string | undefined): CloseBehavior => {
  return value === "hide" ? "hide" : "quit";
};

const resolveWebUrl = () => {
  const configuredUrl = process.env.MANUS_WEB_URL?.trim() || DEFAULT_WEB_URL;

  try {
    return new URL(configuredUrl);
  } catch {
    return new URL(DEFAULT_WEB_URL);
  }
};

const manusWebUrl = resolveWebUrl();
const manusWebOrigin = manusWebUrl.origin;
const closeBehavior = parseCloseBehavior(process.env.MANUS_ELECTRON_CLOSE_BEHAVIOR);

const isSameOrigin = (candidateUrl: string) => {
  try {
    return new URL(candidateUrl).origin === manusWebOrigin;
  } catch {
    return false;
  }
};

const openExternalIfSafe = async (candidateUrl: string) => {
  try {
    const parsedUrl = new URL(candidateUrl);
    if (SAFE_EXTERNAL_PROTOCOLS.has(parsedUrl.protocol)) {
      await shell.openExternal(candidateUrl);
    }
  } catch {
    // Invalid URLs stay blocked.
  }
};

const shouldOpenDevTools = () => {
  return process.env.MANUS_ELECTRON_OPEN_DEVTOOLS === "true";
};

const createMainWindow = async () => {
  const windowTitle = process.env.MANUS_ELECTRON_WINDOW_TITLE?.trim() || DEFAULT_WINDOW_TITLE;
  const initialWidth = parsePositiveInteger(
    process.env.MANUS_ELECTRON_WINDOW_WIDTH,
    DEFAULT_WINDOW_WIDTH
  );
  const initialHeight = parsePositiveInteger(
    process.env.MANUS_ELECTRON_WINDOW_HEIGHT,
    DEFAULT_WINDOW_HEIGHT
  );

  const window = new BrowserWindow({
    title: windowTitle,
    width: initialWidth,
    height: initialHeight,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    backgroundColor: "#111827",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow = window;

  window.once("ready-to-show", () => {
    window.show();
  });

  window.on("close", (event) => {
    if (closeBehavior === "hide" && !isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });

  window.on("closed", () => {
    mainWindow = null;
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSameOrigin(url)) {
      void window.loadURL(url);
    } else {
      void openExternalIfSafe(url);
    }

    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, navigationUrl) => {
    if (isSameOrigin(navigationUrl)) {
      return;
    }

    event.preventDefault();
    void openExternalIfSafe(navigationUrl);
  });

  if (shouldOpenDevTools()) {
    window.webContents.openDevTools({ mode: "detach" });
  }

  await window.loadURL(manusWebUrl.href);
};

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
    return;
  }

  if (mainWindow) {
    mainWindow.show();
  }
});

void app.whenReady().then(createMainWindow);
