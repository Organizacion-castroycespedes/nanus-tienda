import { BadRequestException, Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { ScaleService } from "./scale.service";
import type { ScaleWeightResponse } from "./scale.types";
import { AgentPairingService } from "../agent-security/agent-pairing.service";

@Controller("scale")
export class ScaleController {
  constructor(@Inject(ScaleService) private readonly scaleService: ScaleService,
    @Inject(AgentPairingService) private readonly pairing: AgentPairingService) {}

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
}
