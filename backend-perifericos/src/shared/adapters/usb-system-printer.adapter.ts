import { execFileSync } from "node:child_process";
import { BadRequestException } from "@nestjs/common";
import {
  buildTestPrintDocument,
  buildTicketPrintDocument,
} from "../escpos-mock/thermal-ticket.formatter";
import { ConnectionType, DeviceType, type PeripheralDevice } from "../types/peripheral.types";
import type { DeviceProfile } from "../profiles/device-profiles";
import type {
  AdapterCapabilities,
  PrintTicketAdapterInput,
  PrinterAdapter,
  PrinterAdapterInput,
  PrinterAdapterResult,
} from "./peripheral-adapter.types";

export type UsbPrintCommandRunner = (
  command: string,
  args: string[],
  input?: string
) => void;

const systemPrintCommandRunner: UsbPrintCommandRunner = (command, args, input) => {
  execFileSync(command, args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
  });
};

export class UsbSystemPrinterAdapter implements PrinterAdapter {
  readonly type = DeviceType.PRINTER;
  readonly connectionType = ConnectionType.USB;
  readonly mode = "REAL" as const;
  readonly adapterName = "UsbSystemPrinterAdapter";

  constructor(
    private readonly platform = process.platform,
    private readonly commandRunner: UsbPrintCommandRunner = systemPrintCommandRunner
  ) {}

  getCapabilities(profile: DeviceProfile): AdapterCapabilities {
    return {
      adapterName: this.adapterName,
      mode: this.mode,
      connectionType: this.connectionType,
      supportsCut: profile.supportsCut,
      supportsCashDrawerPulse: false,
    };
  }

  printTest(input: PrinterAdapterInput): PrinterAdapterResult {
    this.validateDevice(input.device);
    const document = buildTestPrintDocument({
      agentName: input.agentName,
      mode: input.mode,
      terminalId: input.terminalId,
      deviceId: input.device.id,
      printerName: input.device.name,
      profileId: input.profile.id,
      connectionType: input.device.connectionType,
      widthChars: input.profile.widthChars,
      paperWidthMm: input.profile.paperWidthMm,
      timestamp: input.timestamp,
    });
    this.print(input.device, document.preview);

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      preview: document.preview,
      commands: document.commands,
    };
  }

  printTicket(input: PrintTicketAdapterInput): PrinterAdapterResult {
    this.validateDevice(input.device);
    const document = buildTicketPrintDocument({
      ticketType: input.ticketType,
      terminalId: input.terminalId,
      deviceId: input.device.id,
      content: input.content,
      widthChars: input.profile.widthChars,
      timestamp: input.timestamp,
    });
    this.print(input.device, document.preview);

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      preview: document.preview,
      commands: document.commands,
    };
  }

  private validateDevice(device: PeripheralDevice): void {
    if (device.type !== DeviceType.PRINTER) {
      throw new BadRequestException("device must be PRINTER");
    }
    if (device.connectionType !== ConnectionType.USB || !device.usb) {
      throw new BadRequestException("device connectionType must be USB with discovered usb config");
    }
  }

  private print(device: PeripheralDevice, document: string): void {
    const queueName = device.usb?.printerName;
    if (!queueName) {
      throw new BadRequestException("USB printer queue is required");
    }

    try {
      if (this.platform === "win32") {
        this.commandRunner("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          encodePowerShellPrint(queueName, document),
        ]);
        return;
      }

      if (this.platform === "linux" || this.platform === "darwin") {
        this.commandRunner("lp", ["-d", queueName, "-o", "raw"], document);
        return;
      }

      throw new BadRequestException(`USB printer transport is not supported on ${this.platform}`);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "unknown print error";
      throw new BadRequestException(`USB printer print failed: ${message}`);
    }
  }
}

const encodePowerShellPrint = (queueName: string, document: string): string => {
  const queueBase64 = Buffer.from(queueName, "utf8").toString("base64");
  const documentBase64 = Buffer.from(document, "utf8").toString("base64");
  const script = [
    "Add-Type -AssemblyName System.Drawing",
    `$queue = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${queueBase64}'))`,
    `$documentText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${documentBase64}'))`,
    "$printDocument = New-Object System.Drawing.Printing.PrintDocument",
    "$printDocument.PrinterSettings.PrinterName = $queue",
    "if (-not $printDocument.PrinterSettings.IsValid) { throw 'USB printer queue not found' }",
    "$printDocument.add_PrintPage({ param($sender, $event) $font = New-Object System.Drawing.Font('Consolas', 8); $event.Graphics.DrawString($documentText, $font, [System.Drawing.Brushes]::Black, 0, 0); $event.HasMorePages = $false })",
    "$printDocument.Print()",
  ].join("; ");

  return Buffer.from(script, "utf16le").toString("base64");
};
