import { Inject, Injectable } from "@nestjs/common";
import {
  DeviceType,
  LogLevel,
  PeripheralEventName,
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
import { DevicesService } from "../devices/devices.service";
import { EventsService } from "../events/events.service";
import { LogsService } from "../logs/logs.service";
import type {
  CashDrawerOpenRequest,
  CashDrawerOpenResponse,
} from "./cash-drawer.types";

const DEFAULT_TERMINAL_ID = "local-terminal";
const DEFAULT_CASH_DRAWER_ID = "mock-cashdrawer-001";

@Injectable()
export class CashDrawerService {
  private readonly adapterResolver = new PeripheralAdapterResolver();

  constructor(
    @Inject(DevicesService) private readonly devicesService: DevicesService,
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(EventsService) private readonly eventsService: EventsService
  ) {}

  open(request: CashDrawerOpenRequest): CashDrawerOpenResponse {
    const record = this.safeRecord(request, "cash drawer payload");
    const terminalId = validateIdentifier(
      optionalString(record, "terminalId", DEFAULT_TERMINAL_ID),
      "terminalId"
    );
    const deviceId = validateIdentifier(
      optionalString(record, "deviceId", DEFAULT_CASH_DRAWER_ID),
      "deviceId"
    );
    const reason = validateFormat(
      optionalString(record, "reason", "MANUAL"),
      "reason"
    );
    const drawer = this.devicesService.findRequired(
      deviceId,
      DeviceType.CASH_DRAWER
    );
    const commandId = createId("mock-cashdrawer-open");
    const timestamp = new Date().toISOString();
    const config = getPeripheralsConfig();
    const profile = this.adapterResolver.resolveProfile(drawer);
    const adapter = this.adapterResolver.resolveCashDrawer(drawer, config.mode);
    const result = adapter.open({
      mode: config.mode,
      terminalId,
      device: drawer,
      profile,
      commandId,
      reason,
      timestamp,
    });

    this.eventsService.emit(PeripheralEventName.CashDrawerOpened, {
      terminalId,
      deviceId: drawer.id,
      commandId,
      reason,
      mode: config.mode,
      profileId: result.profile.id,
      adapterName: result.adapterName,
      commandCount: result.commands.length,
      timestamp,
    });
    this.logsService.append({
      source: "cash-drawer",
      event: "cashdrawer.open.simulated",
      message: "Cash drawer pulse simulated successfully without hardware",
      metadata: {
        terminalId,
        deviceId: drawer.id,
        commandId,
        reason,
        profileId: result.profile.id,
        adapterName: result.adapterName,
        commandCount: result.commands.length,
      },
    });

    return {
      success: true,
      commandId,
      mode: config.mode,
      deviceId: drawer.id,
      terminalId,
      commands: result.commands,
      profile: result.profile,
      capabilities: result.capabilities,
      message: "Cash drawer pulse simulated successfully",
      timestamp,
    };
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
