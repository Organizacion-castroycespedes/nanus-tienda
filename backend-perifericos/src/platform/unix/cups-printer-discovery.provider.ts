import { execFileSync } from "node:child_process";
import { BadRequestException } from "@nestjs/common";
import type {
  DeviceDiscoveryProvider,
  DiscoveredUsbPrinter,
} from "../../shared/discovery/device-discovery-provider";

export type CupsDiscoveryCommandRunner = (command: string, args: string[]) => string;

const systemCommandRunner: CupsDiscoveryCommandRunner = (command, args) =>
  execFileSync(command, args, { encoding: "utf8", timeout: 5000 });

export class CupsPrinterDiscoveryProvider implements DeviceDiscoveryProvider {
  constructor(
    private readonly platform: "linux" | "darwin",
    private readonly commandRunner: CupsDiscoveryCommandRunner = systemCommandRunner
  ) {}

  listUsbPrinters(): DiscoveredUsbPrinter[] {
    try {
      return parseCupsUsbPrinterNames(this.commandRunner("lpstat", ["-v"])).map((queueName) => ({
        name: queueName,
        nativeIdentifier: queueName,
        fingerprint: { source: "CUPS_QUEUE", values: { queueName } },
        platform: this.platform === "darwin" ? "MACOS" : "LINUX",
        architecture: process.arch,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      throw new BadRequestException(`USB printer discovery failed: ${message}`);
    }
  }
}

export const parseCupsUsbPrinterNames = (output: string): string[] =>
  output
    .split(/\r?\n/)
    .map((line) => line.match(/^device for (.+?):\s+usb:/i)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
