import { execFileSync } from "node:child_process";
import { BadRequestException } from "@nestjs/common";
import type {
  DeviceDiscoveryProvider,
  DiscoveredUsbPrinter,
} from "../../shared/discovery/device-discovery-provider";

export type WindowsDiscoveryCommandRunner = (command: string, args: string[]) => string;

const systemCommandRunner: WindowsDiscoveryCommandRunner = (command, args) =>
  execFileSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5000,
  });

export class WindowsPrinterDiscoveryProvider implements DeviceDiscoveryProvider {
  constructor(private readonly commandRunner: WindowsDiscoveryCommandRunner = systemCommandRunner) {}

  listUsbPrinters(): DiscoveredUsbPrinter[] {
    try {
      return parseWindowsPrinterNames(
        this.commandRunner("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Get-Printer | Where-Object { $_.Type -eq 'Local' -and $_.PortName -match '^(USB|DOT4USB)' } | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress",
        ])
      ).map((queueName) => ({
        name: queueName,
        nativeIdentifier: queueName,
        fingerprint: { source: "WINDOWS_PRINT_QUEUE", values: { queueName } },
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
