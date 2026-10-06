import { execFileSync } from "node:child_process";
import { BadRequestException } from "@nestjs/common";
import type {
  DeviceDiscoveryProvider,
  DiscoveredSerialDevice,
  DiscoveredUsbPrinter,
} from "../../shared/discovery/device-discovery-provider";

export type WindowsDiscoveryCommandRunner = (command: string, args: string[]) => string;
export const WINDOWS_PRINTER_DISCOVERY_TIMEOUT_MS = 10_000;
export type WindowsPrinterDiagnostic = {
  Name: string;
  Type: string;
  PortName: string;
  DriverName: string;
  Shared: boolean;
  WorkOffline?: boolean;
};
type WindowsPnpDiagnostic = { InstanceId: string; Class: string; FriendlyName: string; Status: string; Present: boolean; HardwareIds?: string[]; CompatibleIds?: string[]; LocationInfo?: string; LocationPaths?: string[] };
export type WindowsSerialDiagnostic = { DeviceID: string; Name: string; PNPDeviceID: string; Status: string; Present: boolean };

export class WindowsPrinterDiscoveryParseError extends Error {
  constructor(message: string) {
    super(`PARSE_FAILED: ${message}`);
    this.name = "WindowsPrinterDiscoveryParseError";
  }
}

const systemCommandRunner: WindowsDiscoveryCommandRunner = (command, args) =>
  execFileSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: WINDOWS_PRINTER_DISCOVERY_TIMEOUT_MS,
  });

export class WindowsPrinterDiscoveryProvider implements DeviceDiscoveryProvider {
  constructor(
    private readonly commandRunner: WindowsDiscoveryCommandRunner = systemCommandRunner,
    private readonly diagnosticLogger: (printers: WindowsPrinterDiagnostic[]) => void =
      (printers) => console.info("Windows printer inventory", printers)
  ) {}

  listUsbPrinters(): DiscoveredUsbPrinter[] {
    const startedAt = Date.now();
    try {
      const printers = parseWindowsPrinterDiagnostics(
        this.commandRunner("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "$printers = @(Get-Printer | Where-Object { $_.Type -eq 'Local' -and $_.PortName -match '^(USB|DOT4USB)' } | ForEach-Object { [PSCustomObject]@{ Name = [string]$_.Name; Type = $_.Type.ToString(); PortName = [string]$_.PortName; DriverName = [string]$_.DriverName; Shared = [bool]$_.Shared; WorkOffline = [bool]$_.WorkOffline } }); ConvertTo-Json -InputObject $printers -Compress",
        ])
      );
      let pnp: WindowsPnpDiagnostic[] = [];
      try {
        pnp = parseWindowsPnpDiagnostics(this.commandRunner("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "$d=@(Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like 'USB\\*' -and (($_.Class -eq 'USB') -or ($_.CompatibleID -match 'Class_07')) } | ForEach-Object { [PSCustomObject]@{ InstanceId=[string]$_.InstanceId; Class=[string]$_.Class; FriendlyName=[string]$_.FriendlyName; Status=[string]$_.Status; Present=$true; HardwareIds=@($_.HardwareID); CompatibleIds=@($_.CompatibleID); LocationInfo=[string]$_.LocationInfo; LocationPaths=@($_.LocationPaths) } }); ConvertTo-Json -InputObject $d -Compress"]));
      } catch { pnp = []; }
      this.diagnosticLogger(printers);
      console.info("Windows printer discovery completed", {
        durationMs: Date.now() - startedAt,
        timeoutMs: WINDOWS_PRINTER_DISCOVERY_TIMEOUT_MS,
        foundCount: printers.length,
        timeout: false,
      });
      const queueDevices = printers
        .filter((printer) => printer.Type === "Local" && /^(USB|DOT4USB)/i.test(printer.PortName))
        .map((printer) => ({
        name: printer.Name,
        nativeIdentifier: printer.Name,
        fingerprint: {
          source: "WINDOWS_PRINT_QUEUE",
          values: { queueName: printer.Name, portName: printer.PortName, driverName: printer.DriverName, queueReady: String(printer.WorkOffline !== true) },
        },
        platform: "WINDOWS" as const,
        architecture: process.arch,
        }));
      const pnpDevices = pnp.filter((device) => device.Present && (device.CompatibleIds ?? []).some((id) => /class_07/i.test(id))).map((device) => ({
        name: device.FriendlyName || "USB Printer",
        nativeIdentifier: device.InstanceId,
        fingerprint: { source: "WINDOWS_PNP", values: { instanceId: device.InstanceId, class: device.Class, status: device.Status, locationInfo: device.LocationInfo ?? "", locationPaths: (device.LocationPaths ?? []).join(";") } },
        platform: "WINDOWS" as const,
        architecture: process.arch,
      }));
      const seen = new Set(queueDevices.map((device) => device.nativeIdentifier));
      return [...queueDevices, ...pnpDevices.filter((device) => !seen.has(device.nativeIdentifier))];
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      const timeout = /timed?out|ETIMEDOUT/i.test(message);
      console.error("Windows printer discovery failed", {
        durationMs: Date.now() - startedAt,
        timeoutMs: WINDOWS_PRINTER_DISCOVERY_TIMEOUT_MS,
        timeout,
        parseFailure: /PARSE_FAILED/i.test(message),
        errorMessage: message,
      });
      throw new BadRequestException(`USB printer discovery failed: ${message}`);
    }
  }

  listSerialDevices(): DiscoveredSerialDevice[] {
    try {
      return parseWindowsSerialDiagnostics(
        this.commandRunner("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "$d=@(Get-CimInstance Win32_SerialPort | ForEach-Object { [PSCustomObject]@{ DeviceID=[string]$_.DeviceID; Name=[string]$_.Name; PNPDeviceID=[string]$_.PNPDeviceID; Status=[string]$_.Status; Present=($null -ne $_.PNPDeviceID -and $_.Status -eq 'OK') } }); if($d.Count -eq 0){ $d=@(Get-PnpDevice -PresentOnly | Where-Object { $_.Class -eq 'Ports' } | ForEach-Object { $m=[regex]::Match([string]$_.FriendlyName,'\\((COM\\d+)\\)'); if($m.Success){ [PSCustomObject]@{ DeviceID=$m.Groups[1].Value; Name=[string]$_.FriendlyName; PNPDeviceID=[string]$_.InstanceId; Status=[string]$_.Status; Present=$true } } }) }; ConvertTo-Json -InputObject $d -Compress",
        ])
      ).map((device) => {
        const identity = extractUsbVidPid(device.PNPDeviceID);
        return {
          port: device.DeviceID,
          name: device.Name || device.DeviceID,
          nativeIdentifier: device.PNPDeviceID || device.DeviceID,
          pnpDeviceId: device.PNPDeviceID,
          vendorId: identity.vendorId,
          productId: identity.productId,
          status: device.Status,
          present: device.Present,
          fingerprint: {
            source: "WINDOWS_SERIAL_PNP",
            values: {
              pnpDeviceId: device.PNPDeviceID,
              vendorId: identity.vendorId ?? "",
              productId: identity.productId ?? "",
              status: device.Status,
            },
          },
          platform: "WINDOWS" as const,
          architecture: process.arch,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      throw new Error(`Windows serial discovery failed: ${message}`);
    }
  }
}

export const extractUsbVidPid = (
  pnpDeviceId: string
): { vendorId?: string; productId?: string } => {
  const match = pnpDeviceId.match(/VID_([0-9A-F]{4}).*?PID_([0-9A-F]{4})/i);
  return match
    ? { vendorId: match[1].toUpperCase(), productId: match[2].toUpperCase() }
    : {};
};

export const parseWindowsSerialDiagnostics = (
  output: string
): WindowsSerialDiagnostic[] => {
  const trimmed = output.trim();
  if (!trimmed || trimmed === "null") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new WindowsPrinterDiscoveryParseError("invalid JSON from Win32_SerialPort");
  }
  const values = Array.isArray(parsed) ? parsed : [parsed];
  return values.flatMap((value): WindowsSerialDiagnostic[] => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    const deviceId = typeof item.DeviceID === "string" ? item.DeviceID.trim() : "";
    const pnpDeviceId = typeof item.PNPDeviceID === "string" ? item.PNPDeviceID.trim() : "";
    if (!/^COM\d+$/i.test(deviceId) || !pnpDeviceId) return [];
    const status = typeof item.Status === "string" ? item.Status.trim() : "";
    return [{
      DeviceID: deviceId.toUpperCase(),
      Name: typeof item.Name === "string" ? item.Name.trim() : "",
      PNPDeviceID: pnpDeviceId,
      Status: status,
      Present: item.Present === true,
    }];
  });
};

export const parseWindowsPnpDiagnostics = (output: string): WindowsPnpDiagnostic[] => {
  const trimmed = output.trim(); if (!trimmed || trimmed === "null") return [];
  let parsed: unknown; try { parsed = JSON.parse(trimmed); } catch { throw new WindowsPrinterDiscoveryParseError("invalid JSON from Get-PnpDevice"); }
  const values = Array.isArray(parsed) ? parsed : [parsed];
  return values.flatMap((value): WindowsPnpDiagnostic[] => {
    if (!value || typeof value !== "object") return [];
    const p = value as Record<string, unknown>; const instanceId = typeof p.InstanceId === "string" ? p.InstanceId.trim() : "";
    if (!instanceId) return [];
    const strings = (key: string) => Array.isArray(p[key]) ? p[key].filter((v): v is string => typeof v === "string") : [];
    return [{ InstanceId: instanceId, Class: typeof p.Class === "string" ? p.Class : "", FriendlyName: typeof p.FriendlyName === "string" ? p.FriendlyName : "", Status: typeof p.Status === "string" ? p.Status : "", Present: p.Present !== false, HardwareIds: strings("HardwareIds"), CompatibleIds: strings("CompatibleIds"), LocationInfo: typeof p.LocationInfo === "string" ? p.LocationInfo : "", LocationPaths: strings("LocationPaths") }];
  });
};

export const parseWindowsPrinterNames = (output: string): string[] => {
  const trimmed = output.trim();
  if (!trimmed || trimmed === "null") {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const values = Array.isArray(parsed) ? parsed : [parsed];
    return values.filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  } catch {
    return trimmed.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  }
};

export const parseWindowsPrinterDiagnostics = (
  output: string
): WindowsPrinterDiagnostic[] => {
  const trimmed = output.trim();
  if (!trimmed || trimmed === "null") {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new WindowsPrinterDiscoveryParseError("invalid JSON from Get-Printer");
  }
  const values = Array.isArray(parsed) ? parsed : [parsed];
  return values.flatMap((value): WindowsPrinterDiagnostic[] => {
    if (!value || typeof value !== "object") {
      return [];
    }
    const printer = value as Record<string, unknown>;
    const name = typeof printer.Name === "string" ? printer.Name.trim() : "";
    const portName = typeof printer.PortName === "string" ? printer.PortName.trim() : "";
    const driverName = typeof printer.DriverName === "string" ? printer.DriverName.trim() : "";
    const workOffline = typeof printer.WorkOffline === "boolean" ? printer.WorkOffline : undefined;
    const type = printer.Type === 0 || printer.Type === "0" ? "Local" :
      typeof printer.Type === "string" ? printer.Type.trim() : "";
    if (!name || !type || !portName || !driverName || typeof printer.Shared !== "boolean") {
      return [];
    }
    return [{ Name: name, Type: type, PortName: portName, DriverName: driverName, Shared: printer.Shared, ...(workOffline === undefined ? {} : { WorkOffline: workOffline }) }];
  });
};
