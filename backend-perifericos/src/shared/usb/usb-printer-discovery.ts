import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { BadRequestException } from "@nestjs/common";
import type { UsbPrinterConnectionOptions } from "../types/peripheral.types";

export type UsbPrinterDescriptor = UsbPrinterConnectionOptions & {
  id: string;
  name: string;
};

export type UsbPrinterDiscovery = {
  list(): UsbPrinterDescriptor[];
};

export type UsbPrinterCommandRunner = (
  command: string,
  args: string[]
) => string;

const systemCommandRunner: UsbPrinterCommandRunner = (command, args) =>
  execFileSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5000,
  });

export class SystemUsbPrinterDiscovery implements UsbPrinterDiscovery {
  constructor(
    private readonly platform = process.platform,
    private readonly commandRunner: UsbPrinterCommandRunner = systemCommandRunner
  ) {}

  list(): UsbPrinterDescriptor[] {
    try {
      const printerNames =
        this.platform === "win32"
          ? parseWindowsPrinterNames(
              this.commandRunner("powershell.exe", [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-Printer | Where-Object { $_.Type -eq 'Local' -and $_.PortName -match '^(USB|DOT4USB)' } | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress",
              ])
            )
          : this.platform === "linux" || this.platform === "darwin"
            ? parseCupsUsbPrinterNames(this.commandRunner("lpstat", ["-v"]))
            : [];

      return printerNames.map((printerName) => buildUsbPrinterDescriptor(printerName));
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      throw new BadRequestException(
        `USB printer discovery failed: ${message}`
      );
    }
  }
}

export const buildUsbPrinterDescriptor = (
  printerName: string
): UsbPrinterDescriptor => {
  const normalizedName = printerName.trim();
  const hash = createHash("sha256").update(normalizedName).digest("hex").slice(0, 16);
  const deviceId = `usb-printer-${hash}`;

  return {
    id: deviceId,
    name: normalizedName,
    deviceId,
    printerName: normalizedName,
  };
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

export const parseCupsUsbPrinterNames = (output: string): string[] =>
  output
    .split(/\r?\n/)
    .map((line) => line.match(/^device for (.+?):\s+usb:/i)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
