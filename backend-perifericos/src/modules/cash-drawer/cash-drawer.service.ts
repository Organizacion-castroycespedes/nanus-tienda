import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  ConnectionType,
  DeviceStatus,
  DeviceType,
  LogLevel,
  PeripheralEventName,
  type PeripheralDevice,
} from "../../shared/types/peripheral.types";
import { getPeripheralsConfig } from "../../shared/config/peripherals.config";
import { PeripheralAdapterResolver } from "../../shared/adapters/peripheral-adapter.resolver";
import { createId } from "../../shared/utils/id.util";
import {
  asRecord,
  optionalString,
  validateFormat,
  validateIdentifier,
} from "../../shared/utils/request-validation.util";
import {
  DEFAULT_CASH_DRAWER_PULSE_PROFILE,
} from "../../shared/escpos/thermal-escpos.renderer";
import { DevicesService } from "../devices/devices.service";
import { EventsService } from "../events/events.service";
import { LogsService } from "../logs/logs.service";
import type {
  CashDrawerOpenRequest,
  CashDrawerOpenResponse,
} from "./cash-drawer.types";
import type { CashDrawerPulseProfile } from "../../shared/adapters/peripheral-adapter.types";

const DEFAULT_TERMINAL_ID = "local-terminal";
const DEFAULT_REASON = "MANUAL";

@Injectable()
export class CashDrawerService {
  private readonly adapterResolver = new PeripheralAdapterResolver();

  constructor(
    @Inject(DevicesService) private readonly devicesService: DevicesService,
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(EventsService) private readonly eventsService: EventsService
  ) {}

  async open(request: CashDrawerOpenRequest): Promise<CashDrawerOpenResponse> {
    const record = this.safeRecord(request, "cash drawer payload");
    const terminalId = validateIdentifier(
      optionalString(record, "terminalId", DEFAULT_TERMINAL_ID),
      "terminalId"
    );
    const reason = validateFormat(optionalString(record, "reason", DEFAULT_REASON), "reason");
    const printerDeviceId = this.resolvePrinterDeviceId(record, terminalId);
    const printer = this.devicesService.findRequired(printerDeviceId, DeviceType.PRINTER);
    const config = getPeripheralsConfig();
    const profile = this.adapterResolver.resolveProfile(printer);
    const pulse = this.buildPulseProfile(profile.id);

    if (!profile.supportsCashDrawerPulse) {
      throw new BadRequestException("printer does not support cash drawer pulse");
    }

    if (
      printer.connectionType === ConnectionType.USB &&
      !this.isUsbDrawerPulseCertified(printer)
    ) {
      throw new BadRequestException("printer drawer pulse is not certified for this device");
    }

    const adapter = this.adapterResolver.resolvePrinter(printer, config.mode);
    const commandId = createId(
      adapter.mode === "REAL" ? "real-cashdrawer-open" : "mock-cashdrawer-open"
    );
    const timestamp = new Date().toISOString();

    try {
      this.devicesService.assertUsbPrinterAvailable(printer);
      const result = await Promise.resolve(
        adapter.openCashDrawer({
          mode: adapter.mode,
          terminalId,
          device: printer,
          profile,
          commandId,
          reason,
          timestamp,
          pulse,
        })
      );

      const response: CashDrawerOpenResponse = {
        success: true,
        commandId,
        mode: result.capabilities.mode,
        adapterName: result.adapterName,
        printerDeviceId: printer.id,
        deviceId: printer.id,
        terminalId,
        connectionType: printer.connectionType,
        network: printer.network ? { ...printer.network } : undefined,
        commands: result.commands,
        profile: result.profile,
        capabilities: result.capabilities,
        pulse: result.pulse ?? pulse,
        bytesSent: result.bytesSent,
        message:
          result.capabilities.mode === "REAL"
            ? "Cash drawer pulse sent"
            : "Cash drawer pulse simulated successfully",
        timestamp,
      };

      if (result.capabilities.mode === "REAL") {
        this.logsService.append({
          source: "cash-drawer",
          event: "cashdrawer.open.sent",
          message: "Cash drawer pulse sent to configured printer",
          metadata: this.buildMetadata(response, commandId, reason, profile.id),
        });
      } else {
        this.logsService.append({
          source: "cash-drawer",
          event: "cashdrawer.open.simulated",
          message: "Cash drawer pulse simulated successfully without hardware",
          metadata: this.buildMetadata(response, commandId, reason, profile.id),
        });
      }

      this.eventsService.emit(PeripheralEventName.CashDrawerOpened, {
        terminalId,
        deviceId: printer.id,
        printerDeviceId: printer.id,
        connectionType: printer.connectionType,
        network: printer.network ? { ...printer.network } : undefined,
        commandId,
        reason,
        mode: result.capabilities.mode,
        profileId: result.profile.id,
        adapterName: result.adapterName,
        commandCount: result.commands.length,
        bytesSent: result.bytesSent,
        pulse,
        timestamp,
      });

      if (printer.connectionType === ConnectionType.NETWORK) {
        this.devicesService.setRuntimeStatus(printer.id, DeviceStatus.CONNECTED);
      }

      return response;
    } catch (error) {
      this.handleDrawerFailure(printer, terminalId, commandId, reason, profile.id, error);
      throw error;
    }
  }

  private resolvePrinterDeviceId(
    record: Record<string, unknown>,
    terminalId: string
  ): string {
    const requestedPrinterDeviceId = optionalString(record, "printerDeviceId", "").trim();
    if (requestedPrinterDeviceId) {
      const printer = this.findPrinterById(requestedPrinterDeviceId);
      if (!printer) {
        throw new NotFoundException("printer device not found");
      }
      return printer.id;
    }

    const legacyDeviceId = optionalString(record, "deviceId", "").trim();
    if (legacyDeviceId) {
      const device = this.devicesService.findById(legacyDeviceId);
      if (!device) {
        throw new NotFoundException("printer device not found");
      }

      if (device.type === DeviceType.PRINTER) {
        return device.id;
      }

      if (device.type === DeviceType.CASH_DRAWER) {
        const printer = this.findBestPrinterForTerminal(device.terminalId);
        if (printer) {
          return printer.id;
        }
      }
    }

    const terminalPrinter = this.findBestPrinterForTerminal(terminalId);
    if (terminalPrinter) {
      return terminalPrinter.id;
    }

    throw new NotFoundException("printer device not found");
  }

  private findPrinterById(deviceId: string): PeripheralDevice | undefined {
    const device = this.devicesService.findById(validateIdentifier(deviceId, "printerDeviceId"));
    if (!device) {
      return undefined;
    }
    if (device.type !== DeviceType.PRINTER) {
      throw new BadRequestException("printer device must be PRINTER");
    }
    return device;
  }

  private findBestPrinterForTerminal(
    terminalId: string
  ): PeripheralDevice | undefined {
    const printers = this.devicesService
      .list()
      .filter(
        (device) =>
          device.type === DeviceType.PRINTER && device.terminalId === terminalId
      );

    return (
      printers.find(
        (device) =>
          device.connectionType !== ConnectionType.MOCK &&
          device.status === DeviceStatus.CONNECTED
      ) ??
      printers.find((device) => device.connectionType !== ConnectionType.MOCK) ??
      printers.find((device) => device.status === DeviceStatus.CONNECTED) ??
      printers[0]
    );
  }

  private buildPulseProfile(profileId: string): CashDrawerPulseProfile {
    if (profileId === "THERMAL_80MM" || profileId === "THERMAL_58MM") {
      return { ...DEFAULT_CASH_DRAWER_PULSE_PROFILE };
    }

    return { ...DEFAULT_CASH_DRAWER_PULSE_PROFILE };
  }

  private isUsbDrawerPulseCertified(printer: PeripheralDevice): boolean {
    return printer.metadata?.usbRawCashDrawerPulseCertified === true;
  }

  private buildMetadata(
    response: CashDrawerOpenResponse,
    commandId: string,
    reason: string,
    profileId: string
  ): Record<string, unknown> {
    return {
      terminalId: response.terminalId,
      printerDeviceId: response.printerDeviceId,
      deviceId: response.deviceId,
      connectionType: response.connectionType,
      networkHost: response.network?.host,
      networkPort: response.network?.port,
      commandId,
      reason,
      profileId,
      adapterName: response.adapterName,
      mode: response.mode,
      commandCount: response.commands.length,
      bytesSent: response.bytesSent,
      pulse: response.pulse,
    };
  }

  private handleDrawerFailure(
    printer: PeripheralDevice,
    terminalId: string,
    commandId: string,
    reason: string,
    profileId: string,
    error: unknown
  ): void {
    const errorMessage =
      error instanceof Error ? error.message : "Cash drawer pulse failed";

    if (printer.connectionType === ConnectionType.NETWORK) {
      this.devicesService.setRuntimeStatus(printer.id, DeviceStatus.NOT_REACHABLE);
    }

    this.eventsService.emit(PeripheralEventName.DeviceError, {
      terminalId,
      deviceId: printer.id,
      deviceType: printer.type,
      timestamp: new Date().toISOString(),
    });
    this.logsService.append({
      level: LogLevel.ERROR,
      source: "cash-drawer",
      event: "cashdrawer.open.failed",
      message: "Cash drawer pulse failed",
      metadata: {
        terminalId,
        printerDeviceId: printer.id,
        deviceId: printer.id,
        connectionType: printer.connectionType,
        networkHost: printer.network?.host,
        networkPort: printer.network?.port,
        commandId,
        reason,
        profileId,
        errorMessage,
      },
    });
  }

  private safeRecord(value: unknown, context: string) {
    try {
      return asRecord(value, context);
    } catch (error) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "cash-drawer",
        event: "cashdrawer.payload.invalid",
        message: "Cash drawer payload rejected by validation",
        metadata: { context },
      });
      throw error;
    }
  }
}
