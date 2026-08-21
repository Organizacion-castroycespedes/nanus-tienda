import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  DeviceType,
  LogLevel,
  PeripheralEventName,
} from "../../shared/types/peripheral.types";
import { getPeripheralsConfig } from "../../shared/config/peripherals.config";
import type {
  ThermalTicketContent,
  ThermalTicketItem,
  ThermalTicketPayment,
} from "../../shared/escpos-mock/escpos-mock.types";
import { PeripheralAdapterResolver } from "../../shared/adapters/peripheral-adapter.resolver";
import type {
  AdapterMode,
  PrinterAdapterResult,
} from "../../shared/adapters/peripheral-adapter.types";
import { createId } from "../../shared/utils/id.util";
import {
  asRecord,
  optionalString,
  validateIdentifier,
  type UnknownRecord,
} from "../../shared/utils/request-validation.util";
import { DevicesService } from "../devices/devices.service";
import { EventsService } from "../events/events.service";
import { LogsService } from "../logs/logs.service";
import type {
  PrintTicketRequest,
  PrinterJobResponse,
  TestPrintRequest,
} from "./printer.types";

const DEFAULT_TERMINAL_ID = "local-terminal";
const DEFAULT_PRINTER_ID = "mock-printer-001";

@Injectable()
export class PrinterService {
  private readonly adapterResolver = new PeripheralAdapterResolver();

  constructor(
    @Inject(DevicesService) private readonly devicesService: DevicesService,
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(EventsService) private readonly eventsService: EventsService
  ) {}

  async testPrint(request: TestPrintRequest): Promise<PrinterJobResponse> {
    const record = this.safeRecord(request, "test print payload");
    const terminalId = validateIdentifier(
      optionalString(record, "terminalId", DEFAULT_TERMINAL_ID),
      "terminalId"
    );
    const deviceId = validateIdentifier(
      optionalString(record, "deviceId", DEFAULT_PRINTER_ID),
      "deviceId"
    );
    const printer = this.devicesService.findRequired(
      deviceId,
      DeviceType.PRINTER
    );
    const config = getPeripheralsConfig();
    const profile = this.adapterResolver.resolveProfile(printer);
    const adapter = this.adapterResolver.resolvePrinter(printer, config.mode);
    const jobId = createId(
      adapter.mode === "REAL" ? "real-print-job" : "mock-print-job"
    );
    const timestamp = new Date().toISOString();
    let result: PrinterAdapterResult;
    try {
      this.devicesService.assertUsbPrinterAvailable(printer);
      result = await adapter.printTest({
        agentName: config.agentName,
        mode: adapter.mode,
        terminalId,
        device: printer,
        profile,
        jobId,
        timestamp,
      });
    } catch (error) {
      this.recordPrintFailure({
        terminalId,
        deviceId: printer.id,
        jobId,
        ticketType: "TEST_PRINT",
        profileId: profile.id,
        adapterName: adapter.adapterName,
        mode: adapter.mode,
        event: "printer.test_print.failed",
        error,
      });
      throw error;
    }
    const mode = result.capabilities.mode;
    const metadata = {
      terminalId,
      deviceId: printer.id,
      jobId,
      ticketType: "TEST_PRINT",
      profileId: result.profile.id,
      adapterName: result.adapterName,
      mode,
      commandCount: result.commands.length,
      previewLength: result.preview.length,
      widthChars: result.profile.widthChars,
      bytesSent: result.bytesSent,
    };

    this.eventsService.emit(PeripheralEventName.PrinterJobStarted, {
      terminalId,
      deviceId: printer.id,
      jobId,
      jobType: "TEST_PRINT",
      mode,
      profileId: result.profile.id,
      adapterName: result.adapterName,
      commandCount: result.commands.length,
      previewAvailable: true,
      bytesSent: result.bytesSent,
      timestamp,
    });
    this.logsService.append({
      source: "printer",
      event: "printer.test_print.started",
      message:
        mode === "REAL"
          ? "Test print job started"
          : "Test print simulation started",
      metadata,
    });

    this.eventsService.emit(PeripheralEventName.PrinterJobCompleted, {
      terminalId,
      deviceId: printer.id,
      jobId,
      jobType: "TEST_PRINT",
      mode,
      profileId: result.profile.id,
      adapterName: result.adapterName,
      commandCount: result.commands.length,
      previewAvailable: true,
      bytesSent: result.bytesSent,
      timestamp: new Date().toISOString(),
    });
    this.logsService.append({
      source: "printer",
      event:
        mode === "REAL"
          ? "printer.test_print.sent"
          : "printer.test_print.simulated",
      message:
        mode === "REAL"
          ? "Test print sent to configured printer"
          : "Test print simulated successfully",
      metadata,
    });

    return {
      success: true,
      jobId,
      mode,
      adapterName: result.adapterName,
      deviceId: printer.id,
      terminalId,
      preview: result.preview,
      commands: result.commands,
      profile: result.profile,
      capabilities: result.capabilities,
      bytesSent: result.bytesSent,
      message:
        mode === "REAL"
          ? "Print job sent to configured printer"
          : "Test print simulated successfully",
    };
  }

  async printTicket(request: PrintTicketRequest): Promise<PrinterJobResponse> {
    const record = this.safeRecord(request, "ticket print payload");
    const terminalId = validateIdentifier(
      optionalString(record, "terminalId", DEFAULT_TERMINAL_ID),
      "terminalId"
    );
    const deviceId = validateIdentifier(
      optionalString(record, "deviceId", DEFAULT_PRINTER_ID),
      "deviceId"
    );
    const ticketType = validateIdentifier(
      optionalString(record, "ticketType", "GENERIC"),
      "ticketType"
    );
    const printer = this.devicesService.findRequired(
      deviceId,
      DeviceType.PRINTER
    );
    const config = getPeripheralsConfig();
    const profile = this.adapterResolver.resolveProfile(printer);
    const adapter = this.adapterResolver.resolvePrinter(printer, config.mode);
    const jobId = createId(
      adapter.mode === "REAL" ? "real-ticket-job" : "mock-ticket-job"
    );

    if (!record.content || typeof record.content !== "object") {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "printer",
        event: "printer.ticket_print.rejected",
        message: "Ticket print rejected because content is invalid",
        metadata: { terminalId, deviceId, ticketType },
      });
      throw new BadRequestException("content is required");
    }
    const content = this.parseTicketContent(record.content);
    const timestamp = new Date().toISOString();
    let result: PrinterAdapterResult;
    try {
      this.devicesService.assertUsbPrinterAvailable(printer);
      result = await adapter.printTicket({
        agentName: config.agentName,
        ticketType,
        terminalId,
        device: printer,
        content,
        mode: adapter.mode,
        profile,
        jobId,
        timestamp,
      });
    } catch (error) {
      this.recordPrintFailure({
        terminalId,
        deviceId: printer.id,
        jobId,
        ticketType,
        profileId: profile.id,
        adapterName: adapter.adapterName,
        mode: adapter.mode,
        event: "printer.ticket_print.failed",
        error,
      });
      throw error;
    }
    const mode = result.capabilities.mode;
    const metadata = {
      terminalId,
      deviceId: printer.id,
      jobId,
      ticketType,
      profileId: result.profile.id,
      adapterName: result.adapterName,
      mode,
      commandCount: result.commands.length,
      previewLength: result.preview.length,
      widthChars: result.profile.widthChars,
      bytesSent: result.bytesSent,
      itemCount: content.items?.length ?? 0,
      paymentCount: content.payments?.length ?? 0,
      lineCount: content.lines?.length ?? 0,
    };

    this.eventsService.emit(PeripheralEventName.PrinterJobStarted, {
      terminalId,
      deviceId: printer.id,
      jobId,
      ticketType,
      mode,
      profileId: result.profile.id,
      adapterName: result.adapterName,
      commandCount: result.commands.length,
      previewAvailable: true,
      bytesSent: result.bytesSent,
      timestamp,
    });
    this.logsService.append({
      source: "printer",
      event: "printer.ticket_print.started",
      message:
        mode === "REAL"
          ? "Ticket print job started"
          : "Ticket print simulation started",
      metadata,
    });

    this.eventsService.emit(PeripheralEventName.PrinterJobCompleted, {
      terminalId,
      deviceId: printer.id,
      jobId,
      ticketType,
      mode,
      profileId: result.profile.id,
      adapterName: result.adapterName,
      commandCount: result.commands.length,
      previewAvailable: true,
      bytesSent: result.bytesSent,
      timestamp: new Date().toISOString(),
    });
    this.logsService.append({
      source: "printer",
      event:
        mode === "REAL"
          ? "printer.ticket_print.sent"
          : "printer.ticket_print.simulated",
      message:
        mode === "REAL"
          ? "Ticket print sent to configured printer"
          : "Ticket print simulated successfully",
      metadata,
    });

    return {
      success: true,
      jobId,
      mode,
      adapterName: result.adapterName,
      deviceId: printer.id,
      terminalId,
      preview: result.preview,
      commands: result.commands,
      profile: result.profile,
      capabilities: result.capabilities,
      bytesSent: result.bytesSent,
      message:
        mode === "REAL"
          ? "Print job sent to configured printer"
          : "Ticket print simulated successfully",
    };
  }

  private recordPrintFailure(input: {
    terminalId: string;
    deviceId: string;
    jobId: string;
    ticketType: string;
    profileId: string;
    adapterName: string;
    mode: AdapterMode;
    event: string;
    error: unknown;
  }): void {
    const errorMessage =
      input.error instanceof Error ? input.error.message : "Printer job failed";
    const timestamp = new Date().toISOString();
    const metadata = {
      terminalId: input.terminalId,
      deviceId: input.deviceId,
      jobId: input.jobId,
      ticketType: input.ticketType,
      profileId: input.profileId,
      adapterName: input.adapterName,
      mode: input.mode,
      errorMessage,
    };

    this.eventsService.emit(PeripheralEventName.PrinterJobFailed, {
      terminalId: input.terminalId,
      deviceId: input.deviceId,
      jobId: input.jobId,
      ticketType: input.ticketType,
      mode: input.mode,
      profileId: input.profileId,
      adapterName: input.adapterName,
      timestamp,
    });
    this.logsService.append({
      level: LogLevel.ERROR,
      source: "printer",
      event: input.event,
      message: "Printer job failed with controlled error",
      metadata,
    });
  }

  private parseTicketContent(value: unknown): ThermalTicketContent {
    const record = asRecord(value, "content");
    const lines = parseLines(record.lines);
    const items = parseItems(record.items);
    const payments = parsePayments(record.payments);

    return {
      header: optionalTicketText(record, "header"),
      businessName: optionalTicketText(record, "businessName"),
      nit: optionalTicketText(record, "nit") ?? optionalTicketText(record, "taxId"),
      address: optionalTicketText(record, "address"),
      cashier: optionalTicketText(record, "cashier"),
      documentNumber: optionalTicketText(record, "documentNumber"),
      saleNumber: optionalTicketText(record, "saleNumber"),
      date: optionalTicketText(record, "date"),
      footer: optionalTicketText(record, "footer"),
      title: optionalTicketText(record, "title"),
      lines,
      items,
      subtotal: optionalTicketNumber(record, "subtotal"),
      taxes: optionalTicketNumber(record, "taxes"),
      discounts: optionalTicketNumber(record, "discounts"),
      total: optionalTicketNumber(record, "total"),
      paid: optionalTicketNumber(record, "paid"),
      change: optionalTicketNumber(record, "change"),
      balance: optionalTicketNumber(record, "balance"),
      payments,
    };
  }

  private safeRecord(value: unknown, context: string) {
    try {
      return asRecord(value, context);
    } catch (error) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "printer",
        event: "printer.payload.invalid",
        message: "Printer payload rejected by validation",
        metadata: { context },
      });
      throw error;
    }
  }
}

const optionalTicketText = (
  record: UnknownRecord,
  field: string,
  maxLength = 200
): string | undefined => {
  if (!(field in record) || record[field] === undefined || record[field] === null) {
    return undefined;
  }

  const value = record[field];
  if (typeof value !== "string") {
    throw new BadRequestException(`content.${field} must be a string`);
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestException(`content.${field} is too long`);
  }

  return trimmed;
};

const optionalTicketNumber = (
  record: UnknownRecord,
  field: string
): number | undefined => {
  if (!(field in record) || record[field] === undefined || record[field] === null) {
    return undefined;
  }

  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BadRequestException(`content.${field} must be a finite number`);
  }

  return value;
};

const parseLines = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (
    !Array.isArray(value) ||
    value.some((line) => typeof line !== "string")
  ) {
    throw new BadRequestException("content.lines must be an array of strings");
  }
  if (value.length > 100) {
    throw new BadRequestException("content.lines cannot exceed 100 items");
  }

  return value
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
};

const parseItems = (value: unknown): ThermalTicketItem[] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException("content.items must be an array");
  }
  if (value.length > 100) {
    throw new BadRequestException("content.items cannot exceed 100 items");
  }

  return value.map((item, index) => {
    const record = asRecord(item, `content.items[${index}]`);
    const name = optionalTicketText(record, "name", 200);
    if (!name) {
      throw new BadRequestException(`content.items[${index}].name is required`);
    }

    return {
      name,
      quantity: optionalTicketNumber(record, "quantity"),
      unitPrice: optionalTicketNumber(record, "unitPrice"),
      total: optionalTicketNumber(record, "total"),
    };
  });
};

const parsePayments = (value: unknown): ThermalTicketPayment[] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException("content.payments must be an array");
  }
  if (value.length > 20) {
    throw new BadRequestException("content.payments cannot exceed 20 items");
  }

  return value.map((payment, index) => {
    const record = asRecord(payment, `content.payments[${index}]`);
    const method = optionalTicketText(record, "method", 80);
    if (!method) {
      throw new BadRequestException(
        `content.payments[${index}].method is required`
      );
    }

    return {
      method,
      amount: optionalTicketNumber(record, "amount"),
    };
  });
};
