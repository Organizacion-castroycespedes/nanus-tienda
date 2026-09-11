import { execFileSync } from "node:child_process";
import { BadRequestException } from "@nestjs/common";
import {
  buildTestPrintDocument,
  buildTicketPrintDocument,
  createCashDrawerPulseCommands,
} from "../escpos-mock/thermal-ticket.formatter";
import { EscPosMockCommandName } from "../escpos-mock/escpos-mock.types";
import {
  buildCashDrawerPulseBytes,
  renderThermalEscPos,
} from "../escpos/thermal-escpos.renderer";
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

  getCapabilities(profile: DeviceProfile, device?: PeripheralDevice): AdapterCapabilities {
    const drawerCertified = this.isCashDrawerPulseCertified(device);
    return {
      adapterName: this.adapterName,
      mode: this.mode,
      connectionType: this.connectionType,
      supportsCut: profile.supportsCut,
      // Physical cut is not inferred from transport-wide certification.
      // USB printers only advertise it when a device-specific certification
      // path exists. Keep the signal conservative to avoid cross-device false positives.
      supportsPhysicalCut: false,
      supportsCashDrawerPulse: profile.supportsCashDrawerPulse && drawerCertified,
    };
  }

  openCashDrawer(input: CashDrawerAdapterInput): AdapterResult {
    this.validateDevice(input.device);
    const capabilities = this.getCapabilities(input.profile, input.device);
    if (!capabilities.supportsCashDrawerPulse) {
      throw new BadRequestException("printer drawer pulse is not certified for this device");
    }

    const queueName = this.resolveWindowsQueueName(input.device);
    if (!queueName) {
      throw new BadRequestException("WINDOWS_PRINT_QUEUE_REQUIRED: configure a Windows print queue before opening the drawer");
    }

    const commands = createCashDrawerPulseCommands();
    const payload = buildCashDrawerPulseBytes(input.pulse);
    const bytesSent = this.rawTransport.send({
      nativeIdentifier: queueName,
      payload,
      jobName: "Manus POS cash drawer pulse",
    }).bytesSent;

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities,
      commands,
      bytesSent,
      pulse: input.pulse,
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
    const commands = this.resolveRawCommands(document.commands, input.profile);
    const bytesSent = this.print(input.device, document.preview, commands);

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile, input.device),
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
      capabilities: this.getCapabilities(input.profile, input.device),
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

  private isCashDrawerPulseCertified(device?: PeripheralDevice): boolean {
    return device?.metadata?.usbRawCashDrawerPulseCertified === true;
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
    const queueName = this.resolveWindowsQueueName(device);
    if (!queueName) {
      throw new BadRequestException("PRINT_TRANSPORT_NOT_READY: a Windows print queue is required for USB printing");
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
      const rawMessage = error instanceof Error ? error.message : "unknown print error";
      const message = /(?:1801|invalid printer name|OpenPrinter failed)/i.test(rawMessage)
        ? `WINDOWS_INVALID_PRINTER_QUEUE: Windows no reconoce una cola de impresión con ese nombre (${queueName}) [win32Error=1801]`
        : rawMessage;
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

  private resolveWindowsQueueName(device: PeripheralDevice): string | undefined {
    const explicit = device.usb?.windowsQueueName?.trim();
    if (explicit) {
      return explicit;
    }
    const source = device.descriptor?.fingerprint.source;
    const queueInstalled = device.metadata?.queueInstalled === true;
    if (source === "WINDOWS_PRINT_QUEUE" || queueInstalled || source === "LEGACY_QUEUE_NAME") {
      return device.usb?.printerName?.trim() || undefined;
    }
    // Legacy callers created USB devices before physical PnP metadata existed.
    // Keep that contract working; real PnP descriptors always carry a source
    // and are therefore blocked above when no queue is resolved.
    if (!source && device.metadata?.physicalDetected === undefined && device.metadata?.queueInstalled === undefined) {
      return device.usb?.printerName?.trim() || undefined;
    }
    return undefined;
  }
}
