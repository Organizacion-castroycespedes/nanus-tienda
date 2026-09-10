export type ScannerCaptureState = "IDLE" | "ARMED" | "RECEIVING" | "COMPLETE" | "TIMEOUT" | "ERROR";
export type ScannerCapture = { state: ScannerCaptureState; value: string; maxLength: number };

export const armScanner = (maxLength = 128): ScannerCapture => ({ state: "ARMED", value: "", maxLength });
export const receiveScannerKey = (capture: ScannerCapture, key: string): ScannerCapture => {
  if (capture.state !== "ARMED" && capture.state !== "RECEIVING") return capture;
  if (key === "Enter") return capture.value ? { ...capture, state: "COMPLETE" } : { ...capture, state: "ERROR" };
  if (key.length !== 1 || !/[\x20-\x7e]/.test(key)) return capture;
  if (capture.value.length >= capture.maxLength) return { ...capture, state: "ERROR" };
  return { ...capture, state: "RECEIVING", value: capture.value + key };
};
export const timeoutScanner = (capture: ScannerCapture): ScannerCapture => capture.state === "RECEIVING" ? { ...capture, state: "TIMEOUT", value: "" } : capture;
