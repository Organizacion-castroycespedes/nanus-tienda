import { BadRequestException, Body, Controller, Get, Inject, Optional, Post, Query } from "@nestjs/common";
import { ScaleService } from "./scale.service";
import type { ScaleWeightResponse } from "./scale.types";
import { AgentPairingService } from "../agent-security/agent-pairing.service";
import { LogsService } from "../logs/logs.service";
import { LogLevel } from "../../shared/types/peripheral.types";

@Controller("scale")
export class ScaleController {
  constructor(@Inject(ScaleService) private readonly scaleService: ScaleService,
    @Inject(AgentPairingService) private readonly pairing: AgentPairingService,
    @Optional() @Inject(LogsService) private readonly logsService: LogsService = new LogsService()) {}

  @Get("current-weight")
  getCurrentWeight(
    @Query("terminalId") terminalId?: string,
    @Query("deviceId") deviceId?: string
  ): ScaleWeightResponse | Promise<ScaleWeightResponse> {
    return this.scaleService.getCurrentWeight({ terminalId, deviceId });
  }

  @Post("authorization-test")
  async testAuthorizationReading(@Body() input: { posTerminalId: string; logicalScaleId: string }) {
    if (!input?.posTerminalId || !input.logicalScaleId) throw new BadRequestException("SCALE_AUTHORIZATION_CONTEXT_REQUIRED");
    const reading = await this.scaleService.getCurrentWeight({ terminalId: "local-terminal", deviceId: input.logicalScaleId });
    if (!reading || reading.source !== "REAL" || reading.unit !== "kg" || !reading.unitVerified) {
      return { realAvailable: false, reason: "REAL_KG_VERIFIED_OBSERVATION_REQUIRED", reading: {
        source: reading?.source ?? null, unit: reading?.unit ?? null, unitVerified: reading?.unitVerified ?? false,
        observedAt: reading?.timestamp ?? null,
      } };
    }
    const readiness = await this.pairing.submitRealObservation({
      posTerminalId: input.posTerminalId, logicalScaleId: input.logicalScaleId, source: reading.source,
      unit: reading.unit, unitVerified: reading.unitVerified, observedAt: reading.timestamp,
    });
    return { ...readiness, reading: { weight: reading.weight, unit: reading.unit, source: reading.source,
      unitVerified: reading.unitVerified, stable: reading.stable, stabilityVerified: reading.stabilityVerified,
      observedAt: reading.timestamp } };
  }

  @Post("capture")
  async captureForSale(@Body() input: { captureId: string }) {
    if (!input || typeof input.captureId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.captureId)) {
      throw new BadRequestException("WEIGHT_CAPTURE_ID_INVALID");
    }
    const captureId = input.captureId;
    this.logsService.append({ source: "scale", event: "capture.request_received",
      message: "Commercial scale capture request received", metadata: { captureId } });
    // No renderer-selected device: REAL mode requires one unambiguous configured scale.
    let reading: ScaleWeightResponse;
    try {
      reading = await this.scaleService.getCurrentWeight({ terminalId: "local-terminal" });
    } catch (error) {
      this.logsService.append({ level: LogLevel.ERROR, source: "scale", event: "capture.failed",
        message: "Commercial scale capture failed during physical read",
        metadata: { captureId, stage: "real_read", errorCode: "REAL_SCALE_READ_FAILED" } });
      throw error;
    }
    this.logsService.append({ source: "scale", event: "capture.real_read_completed",
      message: "Commercial capture received a physical scale reading", metadata: {
        captureId, source: reading.source, unit: reading.unit, unitVerified: reading.unitVerified,
        stabilityVerified: reading.stabilityVerified, deviceId: reading.deviceId,
        logicalScaleId: reading.deviceId, observedAt: reading.timestamp,
      } });
    const rejectionCode = reading.source !== "REAL" ? "SCALE_SOURCE_NOT_REAL"
      : reading.unit !== "kg" ? "SCALE_UNIT_NOT_KG"
        : !reading.unitVerified ? "SCALE_UNIT_UNVERIFIED"
          : reading.weight === 0 ? "SCALE_WEIGHT_ZERO" : null;
    if (rejectionCode) {
      this.logsService.append({ level: LogLevel.WARN, source: "scale", event: "capture.local_validation_rejected",
        message: "Commercial scale reading rejected by local validation",
        metadata: { captureId, stage: "local_validation", httpStatus: 400, errorCode: rejectionCode } });
      throw new BadRequestException(rejectionCode === "SCALE_WEIGHT_ZERO"
        ? rejectionCode
        : "REAL_KG_VERIFIED_READING_REQUIRED");
    }
    this.logsService.append({ source: "scale", event: "capture.local_validation_passed",
      message: "Commercial scale reading passed local validation", metadata: { captureId, stage: "local_validation" } });
    let accepted: unknown;
    try {
      accepted = await this.pairing.submitSaleCaptureObservation({
        captureId, deviceId: reading.deviceId, weight: reading.weight, unit: reading.unit,
        source: reading.source, unitVerified: reading.unitVerified, observedAt: reading.timestamp,
      });
    } catch (error) {
      this.logsService.append({ level: LogLevel.ERROR, source: "scale", event: "capture.failed",
        message: "Commercial scale capture failed while submitting its observation",
        metadata: { captureId, stage: "observation_submission", errorCode: "OBSERVATION_SUBMISSION_FAILED" } });
      throw error;
    }
    return { ...accepted as object, reading: {
      weight: reading.weight, unit: reading.unit, source: reading.source,
      unitVerified: reading.unitVerified, observedAt: reading.timestamp,
    } };
  }
}
