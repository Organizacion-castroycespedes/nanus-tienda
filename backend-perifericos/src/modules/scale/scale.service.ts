import { Inject, Injectable } from "@nestjs/common";
import {
  DeviceType,
  PeripheralEventName,
} from "../../shared/types/peripheral.types";
import { validateIdentifier } from "../../shared/utils/request-validation.util";
import { DevicesService } from "../devices/devices.service";
import { EventsService } from "../events/events.service";
import { LogsService } from "../logs/logs.service";
import type { ScaleWeightRequest, ScaleWeightResponse } from "./scale.types";

const DEFAULT_TERMINAL_ID = "local-terminal";
const DEFAULT_SCALE_ID = "mock-scale-001";
const MOCK_WEIGHT_KG = 1.25;

@Injectable()
export class ScaleService {
  constructor(
    @Inject(DevicesService) private readonly devicesService: DevicesService,
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(EventsService) private readonly eventsService: EventsService
  ) {}

  getCurrentWeight(request: ScaleWeightRequest): ScaleWeightResponse {
    const terminalId = validateIdentifier(
      request.terminalId?.trim() || DEFAULT_TERMINAL_ID,
      "terminalId"
    );
    const deviceId = validateIdentifier(
      request.deviceId?.trim() || DEFAULT_SCALE_ID,
      "deviceId"
    );
    const scale = this.devicesService.findRequired(deviceId, DeviceType.SCALE);
    const timestamp = new Date().toISOString();
    const response: ScaleWeightResponse = {
      deviceId: scale.id,
      weight: MOCK_WEIGHT_KG,
      unit: "kg",
      stable: true,
      timestamp,
    };

    this.eventsService.emit(PeripheralEventName.ScaleWeightChanged, {
      terminalId,
      deviceId: scale.id,
      weight: response.weight,
      unit: response.unit,
      stable: response.stable,
      timestamp,
    });
    this.logsService.append({
      source: "scale",
      event: "scale.current_weight.simulated",
      message: "Scale current weight simulated successfully",
      metadata: {
        terminalId,
        deviceId: scale.id,
        weight: response.weight,
        unit: response.unit,
        stable: response.stable,
      },
    });

    return response;
  }
}
