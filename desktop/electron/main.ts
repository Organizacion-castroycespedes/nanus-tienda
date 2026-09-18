import { app, BrowserWindow, ipcMain, net, screen, shell } from "electron";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { createAgentDevice, discoverAgentDevices, getAgentCurrentWeight, getAgentHealth, listAgentDevices, listAgentLogs, openAgentCashDrawer, printAgentTicket, simulateAgentScanner, testAgentPrint, updateAgentDevice } from "./agent-client.js";
import { buildRuntimeInfo, IPC_CHANNELS, type AgentHealth, type ShellInfo } from "./electron-api.js";
import {
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
import {
  getRetryDelayMs,
  isRecoverableNetworkError,
  nextRetryAttempt,
  type ConnectivityState,
} from "./connectivity.js";

const DEFAULT_WINDOW_TITLE = "Manus POS";
const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 800;
const MIN_WINDOW_WIDTH = 1024;
const MIN_WINDOW_HEIGHT = 700;
const REMOTE_HEARTBEAT_INTERVAL_MS = 3_000;
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

let electronConfig = resolveElectronConfig();
let packagedShellConfig: VersionedShellConfig | null = null;
let manusWebOrigin = electronConfig.webBaseUrl.origin;
let closeBehavior = parseCloseBehavior(process.env.MANUS_ELECTRON_CLOSE_BEHAVIOR);
let rendererRecoveryTimes: number[] = [];
let maintenanceExitAllowed = false;
let requestManualRetry: (() => void) | null = null;

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
  ipcMain.removeHandler(IPC_CHANNELS.getRuntimeInfo);
  ipcMain.removeAllListeners(IPC_CHANNELS.retryConnection);
  ipcMain.handle(IPC_CHANNELS.getRuntimeInfo, async () => buildRuntimeInfo(
    app.getVersion(),
    packagedShellConfig ? await getAgentHealth(packagedShellConfig) : { available: false },
  ));
  ipcMain.removeHandler(IPC_CHANNELS.getShellInfo);
  ipcMain.removeHandler(IPC_CHANNELS.getAgentHealth);
  ipcMain.removeHandler(IPC_CHANNELS.listDevices);
  ipcMain.removeHandler(IPC_CHANNELS.discoverDevices);
  for (const channel of [IPC_CHANNELS.createDevice, IPC_CHANNELS.updateDevice, IPC_CHANNELS.testPrint, IPC_CHANNELS.printTicket, IPC_CHANNELS.openCashDrawer, IPC_CHANNELS.simulateScanner, IPC_CHANNELS.currentWeight, IPC_CHANNELS.listLogs]) ipcMain.removeHandler(channel);
  ipcMain.handle(IPC_CHANNELS.getShellInfo, () => getShellInfo());
  ipcMain.on(IPC_CHANNELS.retryConnection, () => requestManualRetry?.());
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
  ipcMain.handle(IPC_CHANNELS.printTicket, (_event, payload: unknown) => packagedShellConfig ? printAgentTicket(packagedShellConfig, payload) : null);
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
    icon: path.join(__dirname, "../resources/manus-icon.png"),
    width: initialWidth,
    height: initialHeight,
    frame: false,
    fullscreen: true,
    minimizable: false,
    resizable: false,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    backgroundColor: "#ffffff",
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

  window.webContents.on("render-process-gone", (_event, details) => {
    console.warn(`[connectivity] renderer crash reason=${details.reason} exitCode=${details.exitCode}`);
    const now = Date.now();
    rendererRecoveryTimes = rendererRecoveryTimes.filter((time) => now - time < 60_000);
    if (!shouldRecoverRenderer(rendererRecoveryTimes, now)) {
      void loadConnectivityPage("offline");
      return;
    }
    rendererRecoveryTimes.push(now);
    void loadConnectivityPage("reconnecting").then(scheduleRetry);
  });
  window.webContents.on("did-finish-load", () => {
    const loadedUrl = window.webContents.getURL();
    if (isSameOrigin(loadedUrl)) {
      remotePageLoaded = true;
      lastSuccessfulRemoteUrl = loadedUrl;
      retryAttempt = 0;
      clearRetryTimer();
      console.info(`[connectivity] remote navigation succeeded url=${loadedUrl}`);
    }
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

  const connectivityPagePath = path.join(__dirname, "../resources/connectivity/index.html");
  let isConnectivityPageLoading = false;
  let isRemoteNavigationInFlight = false;
  let retryTimer: NodeJS.Timeout | null = null;
  let retryAttempt = 0;
  let probeInFlight = false;
  let connectivityMonitor: NodeJS.Timeout | null = null;
  let remotePageLoaded = false;
  let lastSuccessfulRemoteUrl = electronConfig.initialUrl.href;

  const clearRetryTimer = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const loadConnectivityPage = async (state: ConnectivityState) => {
    if (window.isDestroyed()) return;
    remotePageLoaded = false;
    isConnectivityPageLoading = true;
    try {
      await window.loadFile(connectivityPagePath, { query: { state } });
    } catch (error) {
      console.warn(`[connectivity] local page failed state=${state}`, error);
    } finally {
      isConnectivityPageLoading = false;
    }
  };

  const probeRemoteService = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await net.fetch(electronConfig.webBaseUrl.href, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "text/html" },
        signal: controller.signal,
      });
      // A 401/403/404 proves the server is reachable and must remain a web/auth
      // decision.  A 5xx is a temporary service failure and remains reconnectable.
      return response.status >= 100 && response.status < 500;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };

  const attemptRemoteNavigation = async () => {
    if (window.isDestroyed() || isRemoteNavigationInFlight) return;
    isRemoteNavigationInFlight = true;
    remotePageLoaded = false;
    try {
      await window.loadURL(lastSuccessfulRemoteUrl);
    } catch (error) {
      console.warn("[connectivity] remote navigation rejected", error);
    } finally {
      isRemoteNavigationInFlight = false;
    }
  };

  const scheduleRetry = () => {
    if (retryTimer || window.isDestroyed()) return;
    const delayMs = getRetryDelayMs(retryAttempt);
    retryAttempt = nextRetryAttempt(retryAttempt);
    console.info(`[connectivity] retryAttempt=${retryAttempt} nextRetryMs=${delayMs}`);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void checkAndReconnect();
    }, delayMs);
  };

  const checkAndReconnect = async () => {
    if (probeInFlight || window.isDestroyed()) return;
    probeInFlight = true;
    await loadConnectivityPage("reconnecting");
    const reachable = await probeRemoteService();
    probeInFlight = false;
    if (!reachable) {
      scheduleRetry();
      return;
    }

    console.info(`[connectivity] remote service reachable restoring=${lastSuccessfulRemoteUrl}`);
    retryAttempt = 0;
    clearRetryTimer();
    await loadConnectivityPage("restored");
    setTimeout(() => void attemptRemoteNavigation(), 900);
  };

  const monitorRemoteConnection = async () => {
    if (!remotePageLoaded || probeInFlight || isConnectivityPageLoading || isRemoteNavigationInFlight || window.isDestroyed()) {
      return;
    }

    const reachable = await probeRemoteService();
    if (reachable || !remotePageLoaded || window.isDestroyed()) {
      return;
    }

    remotePageLoaded = false;
    await loadConnectivityPage("offline");
    scheduleRetry();
  };

  const handleNetworkFailure = (errorCode: number, errorDescription: string, validatedURL: string) => {
    console.warn(`[connectivity] remote navigation failed error=${errorDescription} code=${errorCode} url=${validatedURL}`);
    void loadConnectivityPage("offline").then(scheduleRetry);
  };

  requestManualRetry = () => {
    clearRetryTimer();
    void checkAndReconnect();
  };

  window.on("closed", () => {
    clearRetryTimer();
    if (connectivityMonitor) {
      clearInterval(connectivityMonitor);
      connectivityMonitor = null;
    }
    requestManualRetry = null;
  });

  window.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || isConnectivityPageLoading) return;
    if (!isRecoverableNetworkError(errorCode)) {
      console.warn(`[connectivity] non-recoverable navigation error=${errorDescription} code=${errorCode} url=${validatedURL}`);
      return;
    }
    handleNetworkFailure(errorCode, errorDescription, validatedURL);
  });

  try {
    connectivityMonitor = setInterval(() => void monitorRemoteConnection(), REMOTE_HEARTBEAT_INTERVAL_MS);
    await loadConnectivityPage("startup");
    // Keep a visible local state while the remote web is being verified. A
    // direct loadURL here can leave the BrowserWindow white while DNS/TLS
    // hangs, before did-fail-load has a chance to fire.
    await checkAndReconnect();
  } catch (error) {
    console.warn("[connectivity] initial remote navigation failed", error);
    await loadConnectivityPage("offline");
    scheduleRetry();
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
