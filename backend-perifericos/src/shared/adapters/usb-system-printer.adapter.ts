import { execFileSync } from "node:child_process";
import { BadRequestException } from "@nestjs/common";
import {
  buildTestPrintDocument,
  buildTicketPrintDocument,
} from "../escpos-mock/thermal-ticket.formatter";
import { EscPosMockCommandName } from "../escpos-mock/escpos-mock.types";
import { renderThermalEscPos } from "../escpos/thermal-escpos.renderer";
import {
  getPeripheralsConfig,
  type UsbPrintTransport,
} from "../config/peripherals.config";
import { ConnectionType, DeviceType, type PeripheralDevice } from "../types/peripheral.types";
import type { DeviceProfile } from "../profiles/device-profiles";
import type {
  AdapterCapabilities,
  AdapterResult,
  CashDrawerAdapterInput,
  PrintTicketAdapterInput,
  PrinterAdapter,
  PrinterAdapterInput,
  PrinterAdapterResult,
} from "./peripheral-adapter.types";
import {
  WindowsRawSpoolerTransport,
  type WindowsPrintCommandRunner,
} from "../../platform/windows/windows-raw-spooler.transport";
import { WindowsGdiSpoolerTransport } from "../../platform/windows/windows-gdi-spooler.transport";

export type UsbPrintCommandRunner = WindowsPrintCommandRunner;

const systemPrintCommandRunner: UsbPrintCommandRunner = (command, args, input) => {
  execFileSync(command, args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
  });
};

/** Queue name comes only from agent discovery. Browser never sends ESC/POS. */
export class UsbSystemPrinterAdapter implements PrinterAdapter {
  readonly type = DeviceType.PRINTER;
  readonly connectionType = ConnectionType.USB;
  readonly mode = "REAL" as const;

  constructor(
    private readonly platform = process.platform,
    private readonly commandRunner: UsbPrintCommandRunner = systemPrintCommandRunner,
    private readonly transport: UsbPrintTransport = getPeripheralsConfig().usbPrintTransport,
    private readonly physicalCutCertified =
      getPeripheralsConfig().usbRawPhysicalCutCertified,
    private readonly rawTransport: WindowsRawSpoolerTransport =
      new WindowsRawSpoolerTransport(commandRunner),
    private readonly gdiTransport: WindowsGdiSpoolerTransport =
      new WindowsGdiSpoolerTransport(commandRunner)
  ) {}

  get adapterName(): string {
    return this.transport === "RAW"
      ? "UsbRawPrinterAdapter"
      : "UsbSystemPrinterAdapter";
  }

  getCapabilities(profile: DeviceProfile): AdapterCapabilities {
    return {
      adapterName: this.adapterName,
      mode: this.mode,
      connectionType: this.connectionType,
      supportsCut: profile.supportsCut,
      supportsPhysicalCut:
        this.transport === "RAW" &&
        profile.supportsCut &&
        this.physicalCutCertified,
      supportsCashDrawerPulse: false,
    };
  }

  openCashDrawer(input: CashDrawerAdapterInput): AdapterResult {
    this.validateDevice(input.device);
    const capabilities = this.getCapabilities(input.profile);
    if (!capabilities.supportsCashDrawerPulse) {
      throw new BadRequestException("printer does not support cash drawer pulse");
    }

    throw new BadRequestException("printer does not support cash drawer pulse");
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
    const commands = this.resolveRawCommands(document.commands, input.profile);
    const bytesSent = this.print(input.device, document.preview, commands);

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      preview: document.preview,
      commands,
      bytesSent,
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
    const commands = this.resolveRawCommands(document.commands, input.profile);
    const bytesSent = this.print(input.device, document.preview, commands);

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      preview: document.preview,
      commands,
      bytesSent,
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

  private resolveRawCommands(
    commands: PrinterAdapterResult["commands"],
    profile: DeviceProfile
  ) {
    if (this.transport === "RAW" && profile.supportsCut) {
      return commands;
    }
    return commands.filter((command) => command.name !== EscPosMockCommandName.Cut);
  }

  private print(
    device: PeripheralDevice,
    preview: string,
    commands: PrinterAdapterResult["commands"]
  ): number | undefined {
    const queueName = device.usb?.printerName;
    if (!queueName) {
      throw new BadRequestException("USB printer queue is required");
    }

    try {
      if (this.transport === "RAW") {
        if (this.platform !== "win32") {
          throw new BadRequestException(
            "USB RAW printing is only supported on Windows; configure PERIPHERALS_USB_PRINT_TRANSPORT=GDI for the system-queue fallback"
          );
        }
        const payload = renderThermalEscPos(commands, preview, {
          encoding: "latin1",
          includePhysicalCut: commands.some(
            (command) => command.name === EscPosMockCommandName.Cut
          ),
        });
        return this.rawTransport.send({
          nativeIdentifier: queueName,
          payload,
          jobName: "Manus POS ESC/POS",
        }).bytesSent;
      }

      this.printGdi(queueName, preview);
      return undefined;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "unknown print error";
      const label = this.transport === "RAW" ? "USB RAW printer" : "USB GDI printer";
      throw new BadRequestException(`${label} print failed: ${message}`);
    }
  }

  private printGdi(queueName: string, document: string): void {
    if (this.platform === "win32") {
      this.gdiTransport.print(queueName, document);
      return;
    }

    if (this.platform === "linux" || this.platform === "darwin") {
      this.commandRunner("lp", ["-d", queueName, "-o", "raw"], document);
      return;
    }

    throw new BadRequestException(`USB printer transport is not supported on ${this.platform}`);
  }
}
