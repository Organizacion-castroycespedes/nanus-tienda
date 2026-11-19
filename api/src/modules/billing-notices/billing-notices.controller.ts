import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { BillingNoticesService } from "./billing-notices.service";

export const BILLING_NOTICE_ROLES = ["SUPER_ADMIN", "SUPER_USER", "ADMIN"] as const;

@Controller("billing-notices")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...BILLING_NOTICE_ROLES)
export class BillingNoticesController {
  constructor(@Inject(BillingNoticesService) private readonly service: BillingNoticesService) {}

  /** Avisos de cobro activos del tenant del usuario autenticado (nunca de otro tenant). */
  @Get("active")
  async active(@Req() request: { user?: { tenantId?: string } }) {
    return { items: await this.service.activeForTenant(request.user?.tenantId) };
  }
}
