import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
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
import type { ScaleUnitVerification } from "../../shared/types/peripheral.types";
import { DeviceProfileId } from "../../shared/profiles/device-profiles";
import { getPeripheralsConfig } from "../../shared/config/peripherals.config";

const DEFAULT_TERMINAL_ID = "local-terminal";
const DEFAULT_SCALE_ID = "mock-scale-001";
const MOCK_WEIGHT_KG = 1.25;
export const ROCHI_SERIAL_PORT_FACTORY = Symbol("ROCHI_SERIAL_PORT_FACTORY");
export const SCALE_MONOTONIC_CLOCK = Symbol("SCALE_MONOTONIC_CLOCK");
const ROCHI_READ_TIMEOUT_MS = 2_500;

type ConfiguredScale = ReturnType<DevicesService["getConfiguredScales"]>[number];
type TimedReading = { response: ScaleWeightResponse; openStartedMonoMs: number; frameMonoMs: number };

/**
 * Commercial acquisition evidence. Intervals come from the Agent's local monotonic
 * clock, so they never depend on wall-clock agreement between Windows and the API.
 */
export type ExclusiveScaleAcquisition = {
  reading: ScaleWeightResponse;
  acceptedMonoMs?: number;
  frameMonoMs?: number;
  requestToFrameMs?: number;
};

// Per physical scale: one serial operation at a time. Non-commercial reads may share
// a pending non-commercial read; a commercial capture never shares and never lends.
type ScaleLane = {
  pending: number;
  tail: Promise<void>;
  shared?: Promise<ScaleWeightResponse>;
  exclusiveActive: boolean;
};

const readUnitVerification = (metadata: Record<string, unknown> | undefined): ScaleUnitVerification | undefined => {
  const value = metadata?.unitVerification;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.unit !== "KG" || record.method !== "OPERATOR_CONFIRMATION" || typeof record.verifiedAt !== "string") {
    return undefined;
  }
  return { unit: "KG", method: "OPERATOR_CONFIRMATION", verifiedAt: record.verifiedAt };
};

@Injectable()
export class ScaleService {
  constructor(
    @Inject(DevicesService) private readonly devicesService: DevicesService,
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(EventsService) private readonly eventsService: EventsService,
    @Optional()
    @Inject(ROCHI_SERIAL_PORT_FACTORY)
    private readonly rochiPortFactory: RochiSerialPortFactory = createRochiSerialPort,
    @Optional()
    @Inject(SCALE_MONOTONIC_CLOCK)
    private readonly monotonicNow: () => number = () => performance.now()
  ) {}

  private readonly lanes = new Map<string, ScaleLane>();

  getCurrentWeight(request: ScaleWeightRequest): ScaleWeightResponse | Promise<ScaleWeightResponse> {
    const resolved = this.resolveScale(request);
    if ("mock" in resolved) return resolved.mock;
    const { terminalId, selected } = resolved;
    const lane = this.lane(selected.id);
    if (lane.shared) return lane.shared;
    const operation = this.schedule(lane, () => this.readRochi(terminalId, selected.id, selected.serial!))
      .then((timed) => timed.response);
    lane.shared = operation;
    const clear = () => { if (lane.shared === operation) lane.shared = undefined; };
    operation.then(clear, clear);
    return operation;
  }

  /**
   * Commercial capture read: always opens a new serial session after this request is
   * accepted, never joins a pending read and is never shared with another request.
   */
  async acquireForCapture(request: { terminalId?: string }): Promise<ExclusiveScaleAcquisition> {
    const acceptedMonoMs = this.monotonicNow();
    const resolved = this.resolveScale({ terminalId: request.terminalId });
    if ("mock" in resolved) return { reading: resolved.mock };
    const { terminalId, selected } = resolved;
    const lane = this.lane(selected.id);
    if (lane.exclusiveActive) throw new ConflictException("SCALE_CAPTURE_BUSY");
    lane.exclusiveActive = true;
    try {
      const timed = await this.schedule(lane, () => this.readRochi(terminalId, selected.id, selected.serial!));
      // Order is guaranteed by construction (new serial session after acceptance);
      // this check fails closed if that invariant is ever broken.
      if (!(timed.openStartedMonoMs >= acceptedMonoMs && timed.frameMonoMs >= timed.openStartedMonoMs)) {
        throw new ConflictException("SCALE_ACQUISITION_ORDER_INVALID");
      }
      return { reading: timed.response, acceptedMonoMs, frameMonoMs: timed.frameMonoMs,
        requestToFrameMs: Math.max(0, Math.round(timed.frameMonoMs - acceptedMonoMs)) };
    } finally {
      lane.exclusiveActive = false;
    }
  }

  /** Whole milliseconds elapsed on the local monotonic clock since `monoMs`. */
  elapsedSince(monoMs: number): number {
    return Math.max(0, Math.round(this.monotonicNow() - monoMs));
  }

  private lane(deviceId: string): ScaleLane {
    let lane = this.lanes.get(deviceId);
    if (!lane) {
      lane = { pending: 0, tail: Promise.resolve(), exclusiveActive: false };
      this.lanes.set(deviceId, lane);
    }
    return lane;
  }

  // Runs immediately when the scale is idle; otherwise after every earlier operation
  // has fully settled, including closing its serial port.
  private schedule<T>(lane: ScaleLane, task: () => Promise<T>): Promise<T> {
    const operation = lane.pending === 0 ? task() : lane.tail.then(task);
    lane.pending += 1;
    const settled = operation.then(() => undefined, () => undefined).then(() => { lane.pending -= 1; });
    lane.tail = settled;
    return operation;
  }

  private resolveScale(request: ScaleWeightRequest):
    | { mock: ScaleWeightResponse }
    | { terminalId: string; selected: ConfiguredScale } {
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
      return { mock: this.buildMockResponse(terminalId, deviceId) };
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
    return { terminalId, selected };
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
    serial: NonNullable<ConfiguredScale["serial"]>
  ): Promise<TimedReading> {
    const openStartedMonoMs = this.monotonicNow();
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
      const result = await new Promise<{ value: number; timestamp: string; frameMonoMs: number }>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("ROCHI reading timeout")), ROCHI_READ_TIMEOUT_MS);
        scale.onReading((value) => resolve({ value: value.value, timestamp: new Date(value.receivedAtMs).toISOString(),
          frameMonoMs: this.monotonicNow() }));
        scale.onParseError((error) => reject(new Error(`ROCHI parser error: ${error.code}`)));
        scale.open().catch(reject);
      });
      const configuredDevice = this.devicesService.getConfiguredScales(terminalId).find((device) => device.id === deviceId);
      const unitVerification = readUnitVerification(configuredDevice?.metadata);
      const response: ScaleWeightResponse = {
        deviceId,
        weight: result.value,
        unit: unitVerification ? "kg" : null,
        stable: null,
        source: "REAL",
        unitVerified: Boolean(unitVerification),
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
        metadata: { terminalId, deviceId, logicalScaleId: deviceId, source: response.source,
          unit: response.unit, unitVerified: response.unitVerified,
          stabilityVerified: response.stabilityVerified, observedAt: response.timestamp },
      });
      return { response, openStartedMonoMs, frameMonoMs: result.frameMonoMs };
    } finally {
      if (timer) clearTimeout(timer);
      await scale.close().catch(() => undefined);
    }
  }
}
