import { contextBridge, ipcRenderer } from "electron";

import { IPC_CHANNELS, type ManusTerminalApi } from "./electron-api.js";

const api: ManusTerminalApi = {
  getShellInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getShellInfo),
  getAgentHealth: () => ipcRenderer.invoke(IPC_CHANNELS.getAgentHealth),
  listDevices: () => ipcRenderer.invoke(IPC_CHANNELS.listDevices),
  discoverDevices: (terminalId) => ipcRenderer.invoke(IPC_CHANNELS.discoverDevices, terminalId),
  createDevice: (payload) => ipcRenderer.invoke(IPC_CHANNELS.createDevice, payload),
  updateDevice: (deviceId, payload) => ipcRenderer.invoke(IPC_CHANNELS.updateDevice, deviceId, payload),
  testPrint: (payload) => ipcRenderer.invoke(IPC_CHANNELS.testPrint, payload),
  printTicket: (payload) => ipcRenderer.invoke(IPC_CHANNELS.printTicket, payload),
  openCashDrawer: (payload) => ipcRenderer.invoke(IPC_CHANNELS.openCashDrawer, payload),
  simulateScanner: (payload) => ipcRenderer.invoke(IPC_CHANNELS.simulateScanner, payload),
  currentWeight: (payload) => ipcRenderer.invoke(IPC_CHANNELS.currentWeight, payload),
  listLogs: () => ipcRenderer.invoke(IPC_CHANNELS.listLogs),
};

contextBridge.exposeInMainWorld("manusTerminal", api);
