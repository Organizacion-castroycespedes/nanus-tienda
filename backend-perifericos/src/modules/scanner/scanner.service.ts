import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  DeviceType,
  LogLevel,
  PeripheralEventName,
} from "../../shared/types/peripheral.types";
import {
  asRecord,
  optionalString,
  validateCode,
  validateFormat,
  validateIdentifier,
} from "../../shared/utils/request-validation.util";
import { DevicesService } from "../devices/devices.service";
import { EventsService } from "../events/events.service";
import { LogsService } from "../logs/logs.service";
import type {
  ScannerSimulateRequest,
  ScannerSimulateResponse,
} from "./scanner.types";

const DEFAULT_TERMINAL_ID = "local-terminal";
const DEFAULT_SCANNER_ID = "mock-scanner-001";

@Injectable()
export class ScannerService {
  constructor(
    @Inject(DevicesService) private readonly devicesService: DevicesService,
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(EventsService) private readonly eventsService: EventsService
  ) {}

  simulate(request: ScannerSimulateRequest): ScannerSimulateResponse {
    const record = this.safeRecord(request, "scanner payload");
    const terminalId = validateIdentifier(
      optionalString(record, "terminalId", DEFAULT_TERMINAL_ID),
      "terminalId"
    );
    const deviceId = validateIdentifier(
      optionalString(record, "deviceId", DEFAULT_SCANNER_ID),
      "deviceId"
    );
    const code = optionalString(record, "code", "");
    const format = validateFormat(
      optionalString(record, "format", "UNKNOWN"),
      "format"
    );

    if (!code) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "scanner",
        event: "scanner.code_read.rejected",
        message: "Scanner simulation rejected because code is required",
        metadata: { terminalId, deviceId, format },
      });
      throw new BadRequestException("code is required");
    }
    validateCode(code);

    const scanner = this.devicesService.findRequired(
      deviceId,
      DeviceType.SCANNER
    );
    const timestamp = new Date().toISOString();

    this.eventsService.emit(PeripheralEventName.ScannerCodeRead, {
      terminalId,
      deviceId: scanner.id,
      code,
      format,
      timestamp,
    });
    this.logsService.append({
      source: "scanner",
      event: "scanner.code_read.simulated",
      message: "Scanner code read simulated successfully",
      metadata: {
        terminalId,
        deviceId: scanner.id,
        code,
        format,
      },
    });

    return {
      success: true,
      code,
      format,
      timestamp,
    };
  }

  private safeRecord(value: unknown, context: string) {
    try {
      return asRecord(value, context);
    } catch (error) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "scanner",
        event: "scanner.payload.invalid",
        message: "Scanner payload rejected by validation",
        metadata: { context },
      });
      throw error;
    }
  }
}
