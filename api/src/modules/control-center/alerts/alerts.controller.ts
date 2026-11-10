import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import { buildControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterAdmin } from "../control-center-admin.decorator";
import { ControlCenterAlertsService } from "./alerts.service";

@Controller("admin/control-center")
@ControlCenterAdmin()
export class AlertsController {
  constructor(@Inject(ControlCenterAlertsService) private readonly alerts: ControlCenterAlertsService) {}

  @Get("alerts/status")
  status() {
    return this.alerts.status();
  }

  @Post("alerts/run")
  run(@Req() request: any) {
    return this.alerts.runAll("MANUAL", buildControlCenterRequestContext(request));
  }

  @Post("alerts/test-email")
  testEmail(@Body() body: unknown, @Req() request: any) {
    return this.alerts.testEmail(body, buildControlCenterRequestContext(request));
  }

  @Post("charges/:chargeId/remind")
  remind(@Param("chargeId") chargeId: string, @Req() request: any) {
    return this.alerts.sendReminder(chargeId, buildControlCenterRequestContext(request));
  }
}
