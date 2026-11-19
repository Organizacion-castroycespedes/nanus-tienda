import { Controller, Get, Inject } from "@nestjs/common";
import { ControlCenterAdmin } from "./control-center-admin.decorator";
import { ControlCenterReadinessService } from "./control-center-readiness.service";

@Controller("admin/control-center")
@ControlCenterAdmin()
export class ControlCenterReadinessController {
  constructor(
    @Inject(ControlCenterReadinessService)
    private readonly readiness: ControlCenterReadinessService,
  ) {}

  @Get("readiness")
  getReadiness() {
    return this.readiness.getReadiness();
  }
}
