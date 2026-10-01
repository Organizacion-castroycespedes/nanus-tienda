import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import {
  DeviceType,
  PeripheralEventName,
} from "../../shared/types/peripheral.types";
import { validateIdentifier } from "../../shared/utils/request-validation.util";
import { DevicesService } from "../devices/devices.service";
import { EventsService } from "../events/events.service";
import { LogsService } from "../logs/logs.service";
import type { ScaleWeightRequest, ScaleWeightResponse } from "./scale.types";
import { RochiA01eSerialScale } from "./rochi-a01e.serial";
import { createRochiSerialPort } from "./rochi-a01e.serial-port.factory";
import type { RochiSerialPortFactory } from "./rochi-a01e.serial";
import { ConnectionType } from "../../shared/types/peripheral.types";
import { DeviceProfileId } from "../../shared/profiles/device-profiles";
import { getPeripheralsConfig } from "../../shared/config/peripherals.config";

const DEFAULT_TERMINAL_ID = "local-terminal";
const DEFAULT_SCALE_ID = "mock-scale-001";
const MOCK_WEIGHT_KG = 1.25;
export const ROCHI_SERIAL_PORT_FACTORY = Symbol("ROCHI_SERIAL_PORT_FACTORY");
const ROCHI_READ_TIMEOUT_MS = 2_500;

@Injectable()
export class ScaleService {
  constructor(
    @Inject(DevicesService) private readonly devicesService: DevicesService,
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(EventsService) private readonly eventsService: EventsService,
    @Optional()
    @Inject(ROCHI_SERIAL_PORT_FACTORY)
    private readonly rochiPortFactory: RochiSerialPortFactory = createRochiSerialPort
  ) {}

  private readonly inFlight = new Map<string, Promise<ScaleWeightResponse>>();

  getCurrentWeight(request: ScaleWeightRequest): ScaleWeightResponse | Promise<ScaleWeightResponse> {
    const terminalId = validateIdentifier(
      request.terminalId?.trim() || DEFAULT_TERMINAL_ID,
      "terminalId"
    );
    const deviceId = validateIdentifier(
      request.deviceId?.trim() || DEFAULT_SCALE_ID,
      "deviceId"
    );
    if (getPeripheralsConfig().mode !== "REAL") {
      this.devicesService.findRequired(deviceId, DeviceType.SCALE);
      return this.buildMockResponse(terminalId, deviceId);
    }

    const configuredScales = this.devicesService.getConfiguredScales(terminalId);
    const selected = request.deviceId?.trim()
      ? configuredScales.find((device) => device.id === deviceId)
      : configuredScales.length === 1 ? configuredScales[0] : undefined;
    if (configuredScales.length === 0 || !selected) {
      if (configuredScales.length > 1 && !request.deviceId) {
        throw new BadRequestException("multiple configured scales require deviceId");
      }
      throw new NotFoundException("configured SCALE device not found");
    }
    if (
      selected.connectionType !== ConnectionType.SERIAL ||
      selected.profileId !== DeviceProfileId.RochiA01e ||
      !selected.serial
    ) {
      throw new BadRequestException("configured SCALE is not a supported ROCHI serial device");
    }

    const active = this.inFlight.get(selected.id);
    if (active) return active;
    const operation = this.readRochi(terminalId, selected.id, selected.serial).finally(() => {
      this.inFlight.delete(selected.id);
    });
    this.inFlight.set(selected.id, operation);
    return operation;
  }

  private buildMockResponse(terminalId: string, deviceId: string): ScaleWeightResponse {
    const timestamp = new Date().toISOString();
    const response: ScaleWeightResponse = {
      deviceId,
      weight: MOCK_WEIGHT_KG,
      unit: "kg",
      stable: true,
      source: "MOCK",
      unitVerified: false,
      stabilityVerified: true,
      timestamp,
    };

    this.eventsService.emit(PeripheralEventName.ScaleWeightChanged, {
      terminalId,
      deviceId,
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
        deviceId,
        weight: response.weight,
        unit: response.unit,
        stable: response.stable,
      },
    });

    return response;
  }

  private async readRochi(
    terminalId: string,
    deviceId: string,
    serial: NonNullable<ReturnType<DevicesService["getConfiguredScales"]>[number]["serial"]>
  ): Promise<ScaleWeightResponse> {
    const scale = new RochiA01eSerialScale({
      path: serial.port,
      sourceUnit: "UNKNOWN",
      baudRate: serial.baudRate,
      dataBits: serial.dataBits,
      stopBits: serial.stopBits,
      parity: serial.parity,
      rtscts: serial.flowControl === "rtscts",
    }, this.rochiPortFactory, "REAL");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await new Promise<{ value: number; timestamp: string }>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("ROCHI reading timeout")), ROCHI_READ_TIMEOUT_MS);
        scale.onReading((value) => resolve({ value: value.value, timestamp: new Date(value.receivedAtMs).toISOString() }));
        scale.onParseError((error) => reject(new Error(`ROCHI parser error: ${error.code}`)));
        scale.open().catch(reject);
      });
      const response: ScaleWeightResponse = {
        deviceId,
        weight: result.value,
        unit: null,
        stable: null,
        source: "REAL",
        unitVerified: false,
        stabilityVerified: false,
        timestamp: result.timestamp,
      };
      this.eventsService.emit(PeripheralEventName.ScaleWeightChanged, {
        terminalId, deviceId, weight: response.weight, unit: response.unit,
        stable: response.stable, source: response.source, timestamp: response.timestamp,
      });
      this.logsService.append({
        source: "scale", event: "scale.current_weight.real",
        message: "Scale current weight read from ROCHI",
        metadata: { terminalId, deviceId, source: "REAL", unitVerified: false, stabilityVerified: false },
      });
      return response;
    } finally {
      if (timer) clearTimeout(timer);
      await scale.close().catch(() => undefined);
    }
  }
}
