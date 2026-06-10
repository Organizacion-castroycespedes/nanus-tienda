import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ScaleService } from "./scale.service";
import type { ScaleWeightResponse } from "./scale.types";

@Controller("scale")
export class ScaleController {
  constructor(@Inject(ScaleService) private readonly scaleService: ScaleService) {}

  @Get("current-weight")
  getCurrentWeight(
    @Query("terminalId") terminalId?: string,
    @Query("deviceId") deviceId?: string
  ): ScaleWeightResponse {
    return this.scaleService.getCurrentWeight({ terminalId, deviceId });
  }
}
