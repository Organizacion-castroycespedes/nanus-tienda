export type ScannerSimulateRequest = {
  terminalId?: string;
  deviceId?: string;
  code?: string;
  format?: string;
};

export type ScannerSimulateResponse = {
  success: true;
  code: string;
  format: string;
  timestamp: string;
};
