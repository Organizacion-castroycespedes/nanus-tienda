import { Body, Controller, Get, Inject, Param, Post, Query, Req } from "@nestjs/common";
import { buildControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterAdmin } from "../control-center-admin.decorator";
import { BillingService } from "./billing.service";
import { ChargesService } from "./charges.service";

@Controller("admin/control-center")
@ControlCenterAdmin()
export class ChargesController {
  constructor(
    @Inject(ChargesService) private readonly charges: ChargesService,
    @Inject(BillingService) private readonly billing: BillingService,
  ) {}

  @Get("charges")
  list(@Query() query: Record<string, unknown>) {
    return this.charges.list(query);
  }

  @Get("charges/:chargeId")
  get(@Param("chargeId") chargeId: string) {
    return this.charges.get(chargeId);
  }

  @Post("charges/:chargeId/void")
  void(@Param("chargeId") chargeId: string, @Body() body: unknown, @Req() request: any) {
    return this.charges.void(chargeId, body, buildControlCenterRequestContext(request));
  }

  @Post("contracts/:contractId/charges/generate")
  generate(@Param("contractId") contractId: string, @Req() request: any) {
    return this.billing.generateForContract(contractId, buildControlCenterRequestContext(request));
  }

  @Get("billing-runs")
  runs(@Query() query: Record<string, unknown>) {
    return this.charges.listRuns(query);
  }
}
