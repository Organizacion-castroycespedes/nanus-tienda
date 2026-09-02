import { execFileSync } from "node:child_process";
import { BadRequestException } from "@nestjs/common";
import type {
  DeviceDiscoveryProvider,
  DiscoveredUsbPrinter,
} from "../../shared/discovery/device-discovery-provider";

export type WindowsDiscoveryCommandRunner = (command: string, args: string[]) => string;
export type WindowsPrinterDiagnostic = {
  Name: string;
  Type: string;
  PortName: string;
  DriverName: string;
  Shared: boolean;
};

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
    timeout: 5000,
  });

export class WindowsPrinterDiscoveryProvider implements DeviceDiscoveryProvider {
  constructor(
    private readonly commandRunner: WindowsDiscoveryCommandRunner = systemCommandRunner,
    private readonly diagnosticLogger: (printers: WindowsPrinterDiagnostic[]) => void =
      (printers) => console.info("Windows printer inventory", printers)
  ) {}

  listUsbPrinters(): DiscoveredUsbPrinter[] {
    try {
      const printers = parseWindowsPrinterDiagnostics(
        this.commandRunner("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "$printers = @(Get-Printer | Where-Object { $_.Type -eq 'Local' -and $_.PortName -match '^(USB|DOT4USB)' } | ForEach-Object { [PSCustomObject]@{ Name = [string]$_.Name; Type = $_.Type.ToString(); PortName = [string]$_.PortName; DriverName = [string]$_.DriverName; Shared = [bool]$_.Shared } }); ConvertTo-Json -InputObject $printers -Compress",
        ])
      );
      this.diagnosticLogger(printers);
      return printers
        .filter((printer) => printer.Type === "Local" && /^(USB|DOT4USB)/i.test(printer.PortName))
        .map((printer) => ({
        name: printer.Name,
        nativeIdentifier: printer.Name,
        fingerprint: {
          source: "WINDOWS_PRINT_QUEUE",
          values: { queueName: printer.Name },
        },
        platform: "WINDOWS",
        architecture: process.arch,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      throw new BadRequestException(`USB printer discovery failed: ${message}`);
    }
  }
}

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
    const type = printer.Type === 0 || printer.Type === "0" ? "Local" :
      typeof printer.Type === "string" ? printer.Type.trim() : "";
    if (!name || !type || !portName || !driverName || typeof printer.Shared !== "boolean") {
      return [];
    }
    return [{ Name: name, Type: type, PortName: portName, DriverName: driverName, Shared: printer.Shared }];
  });
};
