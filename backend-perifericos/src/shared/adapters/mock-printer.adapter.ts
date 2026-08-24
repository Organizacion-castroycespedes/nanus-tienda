import { BadRequestException } from "@nestjs/common";
import {
  buildTestPrintDocument,
  buildTicketPrintDocument,
  createCashDrawerPulseCommands,
} from "../escpos-mock/thermal-ticket.formatter";
import { ConnectionType, DeviceType } from "../types/peripheral.types";
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

export class MockPrinterAdapter implements PrinterAdapter {
  readonly type = DeviceType.PRINTER;
  readonly connectionType = ConnectionType.MOCK;
  readonly mode = "MOCK" as const;
  readonly adapterName = "MockPrinterAdapter";

  getCapabilities(profile: DeviceProfile): AdapterCapabilities {
    return {
      adapterName: this.adapterName,
      mode: this.mode,
      connectionType: this.connectionType,
      supportsCut: profile.supportsCut,
      supportsPhysicalCut: false,
      supportsCashDrawerPulse: profile.supportsCashDrawerPulse,
    };
  }

  openCashDrawer(input: CashDrawerAdapterInput): AdapterResult {
    this.validateDrawerDevice(input.device);
    const commands = createCashDrawerPulseCommands();

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      commands,
      pulse: input.pulse,
    };
  }

  printTest(input: PrinterAdapterInput): PrinterAdapterResult {
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

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      preview: document.preview,
      commands: document.commands,
    };
  }

  printTicket(input: PrintTicketAdapterInput): PrinterAdapterResult {
    const document = buildTicketPrintDocument({
      ticketType: input.ticketType,
      terminalId: input.terminalId,
      deviceId: input.device.id,
      content: input.content,
      widthChars: input.profile.widthChars,
      timestamp: input.timestamp,
    });

    return {
      adapterName: this.adapterName,
      profile: input.profile,
      capabilities: this.getCapabilities(input.profile),
      preview: document.preview,
      commands: document.commands,
    };
  }

  private validateDrawerDevice(device: PrinterAdapterInput["device"]): void {
    if (device.type !== DeviceType.PRINTER) {
      throw new BadRequestException("device must be PRINTER");
    }
  }
}
