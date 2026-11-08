import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PlatformTenantGuard } from "../../common/guards/platform-tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ControlCenterEnabledGuard } from "./control-center-enabled.guard";
import { ControlCenterReadinessService } from "./control-center-readiness.service";

@Controller("admin/control-center")
@UseGuards(JwtAuthGuard, RolesGuard, PlatformTenantGuard, ControlCenterEnabledGuard)
@Roles("SUPER_ADMIN")
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
