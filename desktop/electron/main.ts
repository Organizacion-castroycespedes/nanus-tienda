import { app, BrowserWindow, ipcMain, screen, shell } from "electron";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { createAgentDevice, discoverAgentDevices, getAgentCurrentWeight, getAgentHealth, listAgentDevices, listAgentLogs, openAgentCashDrawer, simulateAgentScanner, testAgentPrint, updateAgentDevice } from "./agent-client.js";
import { IPC_CHANNELS, type AgentHealth, type ShellInfo } from "./electron-api.js";
import {
  DEFAULT_MANUS_WEB_URL,
  resolveElectronConfig,
  validateVersionedShellConfig,
  type VersionedShellConfig,
} from "./config.js";
import {
  calculateTerminalBounds,
  enforceTerminalWindowState,
  shouldRecoverRenderer,
  showAndEnforceTerminalWindow,
} from "./window-policy.js";

const DEFAULT_WINDOW_TITLE = "Manus POS";
const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 800;
const MIN_WINDOW_WIDTH = 1024;
const MIN_WINDOW_HEIGHT = 700;
const SAFE_EXTERNAL_PROTOCOLS = new Set(["https:"]);

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

let electronConfig = resolveElectronConfig({ MANUS_WEB_URL: DEFAULT_MANUS_WEB_URL });
let packagedShellConfig: VersionedShellConfig | null = null;
let manusWebOrigin = electronConfig.webBaseUrl.origin;
let closeBehavior = parseCloseBehavior(process.env.MANUS_ELECTRON_CLOSE_BEHAVIOR);
let rendererRecoveryTimes: number[] = [];
let maintenanceExitAllowed = false;

const getPrimaryDisplayBounds = () => calculateTerminalBounds(screen.getPrimaryDisplay().bounds);

const hasSingleInstanceLock = app.requestSingleInstanceLock();

const allowMaintenanceExit = () => {
  maintenanceExitAllowed = true;
};

const focusMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  showAndEnforceTerminalWindow(mainWindow, getPrimaryDisplayBounds());
  mainWindow.focus();
};

const loadShellConfig = async () => {
  if (!app.isPackaged) {
    return;
  }
  const configPath = path.join(process.resourcesPath, "manus-shell.config.json");
  try {
    const raw = JSON.parse(await readFile(configPath, "utf8"));
    packagedShellConfig = validateVersionedShellConfig(raw);
    electronConfig = resolveElectronConfig({
      MANUS_WEB_URL: packagedShellConfig.frontendUrl,
    });
    manusWebOrigin = packagedShellConfig.allowedOrigins[0];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid shell config";
    throw new Error(`Shell configuration unavailable: ${message}`);
  }
};

const getShellInfo = (): ShellInfo => ({
  environment: packagedShellConfig?.environment ?? "dev",
  shellVersion: app.getVersion(),
  frontendOrigin: manusWebOrigin,
  agentAvailable: Boolean(packagedShellConfig),
});

const registerIpcHandlers = () => {
  ipcMain.removeHandler(IPC_CHANNELS.getShellInfo);
  ipcMain.removeHandler(IPC_CHANNELS.getAgentHealth);
  ipcMain.removeHandler(IPC_CHANNELS.listDevices);
  ipcMain.removeHandler(IPC_CHANNELS.discoverDevices);
  for (const channel of [IPC_CHANNELS.createDevice, IPC_CHANNELS.updateDevice, IPC_CHANNELS.testPrint, IPC_CHANNELS.openCashDrawer, IPC_CHANNELS.simulateScanner, IPC_CHANNELS.currentWeight, IPC_CHANNELS.listLogs]) ipcMain.removeHandler(channel);
  ipcMain.handle(IPC_CHANNELS.getShellInfo, () => getShellInfo());
  ipcMain.handle(IPC_CHANNELS.getAgentHealth, async (): Promise<AgentHealth> => {
    if (!packagedShellConfig) {
      return { available: false, reason: "UNAVAILABLE" };
    }
    return getAgentHealth(packagedShellConfig);
  });
  ipcMain.handle(IPC_CHANNELS.listDevices, async () => {
    if (!packagedShellConfig) return [];
    return listAgentDevices(packagedShellConfig);
  });
  ipcMain.handle(IPC_CHANNELS.discoverDevices, async (_event, terminalId: unknown) => {
    if (!packagedShellConfig || typeof terminalId !== "string") return { devices: [] };
    return discoverAgentDevices(packagedShellConfig, terminalId);
  });
  ipcMain.handle(IPC_CHANNELS.createDevice, (_event, payload: unknown) => packagedShellConfig ? createAgentDevice(packagedShellConfig, payload) : []);
  ipcMain.handle(IPC_CHANNELS.updateDevice, (_event, id: unknown, payload: unknown) => packagedShellConfig ? updateAgentDevice(packagedShellConfig, typeof id === "string" ? id : "", payload) : null);
  ipcMain.handle(IPC_CHANNELS.testPrint, (_event, payload: unknown) => packagedShellConfig ? testAgentPrint(packagedShellConfig, payload) : null);
  ipcMain.handle(IPC_CHANNELS.openCashDrawer, (_event, payload: unknown) => packagedShellConfig ? openAgentCashDrawer(packagedShellConfig, payload) : null);
  ipcMain.handle(IPC_CHANNELS.simulateScanner, (_event, payload: unknown) => packagedShellConfig ? simulateAgentScanner(packagedShellConfig, payload) : null);
  ipcMain.handle(IPC_CHANNELS.currentWeight, (_event, payload: unknown) => packagedShellConfig ? getAgentCurrentWeight(packagedShellConfig, payload) : null);
  ipcMain.handle(IPC_CHANNELS.listLogs, () => packagedShellConfig ? listAgentLogs(packagedShellConfig) : []);
};

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
    frame: false,
    fullscreen: true,
    minimizable: false,
    resizable: false,
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
  const fitToPrimaryDisplay = () => {
    if (window.isDestroyed()) {
      return;
    }
    const display = screen.getPrimaryDisplay();
    enforceTerminalWindowState(window, calculateTerminalBounds(display.bounds));
  };

  fitToPrimaryDisplay();
  const onDisplayChanged = () => fitToPrimaryDisplay();
  screen.on("display-metrics-changed", onDisplayChanged);
  screen.on("display-added", onDisplayChanged);
  screen.on("display-removed", onDisplayChanged);

  window.once("ready-to-show", () => {
    showAndEnforceTerminalWindow(window, getPrimaryDisplayBounds());
  });

  window.on("close", (event) => {
    if (!isQuitting && !maintenanceExitAllowed) {
      event.preventDefault();
      window.webContents.send("manusTerminal.closeBlocked");
    }
  });

  window.on("closed", () => {
    screen.off("display-metrics-changed", onDisplayChanged);
    screen.off("display-added", onDisplayChanged);
    screen.off("display-removed", onDisplayChanged);
    mainWindow = null;
  });

  window.webContents.on("render-process-gone", () => {
    const now = Date.now();
    rendererRecoveryTimes = rendererRecoveryTimes.filter((time) => now - time < 60_000);
    if (!shouldRecoverRenderer(rendererRecoveryTimes, now)) {
      void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent("<h1>Manus POS no pudo recuperarse.</h1><p>Reinicia la aplicación o contacta soporte.</p>")}`);
      return;
    }
    rendererRecoveryTimes.push(now);
    void window.webContents.reload();
  });
  window.webContents.on("unresponsive", () => {
    console.warn("[Manus Electron] renderer unresponsive");
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

  if (shouldOpenDevTools() && !app.isPackaged) {
    window.webContents.openDevTools({ mode: "detach" });
  }

  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  window.webContents.session.on("will-download", (_event, item) => {
    item.cancel();
  });

  try {
    await window.loadURL(electronConfig.initialUrl.href);
  } catch {
    const errorPage = `<!doctype html><meta charset="utf-8"><title>Manus POS</title><body style="font-family:sans-serif;padding:3rem"><h1>No pudimos cargar Manus POS.</h1><p>Revisa tu conexión e intenta nuevamente.</p><button onclick="location.reload()">Reintentar</button></body>`;
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorPage)}`);
  }
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
    showAndEnforceTerminalWindow(mainWindow, getPrimaryDisplayBounds());
    mainWindow.focus();
  }
});

if (hasSingleInstanceLock) {
  app.on("second-instance", () => focusMainWindow());
}

void (hasSingleInstanceLock ? app.whenReady() : Promise.resolve()).then(async () => {
  if (!hasSingleInstanceLock) {
    return;
  }
  try {
    await loadShellConfig();
    registerIpcHandlers();
    await createMainWindow();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shell configuration unavailable";
    console.error(`[Manus Electron] ${message}`);
    app.quit();
  }
});
