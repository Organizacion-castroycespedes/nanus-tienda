import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { OperationalSalesService } from "./operational-sales.service";
import type { OperationalSalesQueryDto } from "./dto/operational-sales-query.dto";
import { UpdateSaleCustomerDto } from "./dto/update-sale-customer.dto";
import { CorrectSalePaymentsDto } from "./dto/correct-sale-payments.dto";
import { VoidOperationalSaleDto } from "./dto/void-operational-sale.dto";
import { OperationalDebitNoteDto } from "./dto/operational-debit-note.dto";

type OperationalRequest = Request & {
  user?: { id?: string; tenantId?: string; roles?: string[] };
  context?: {
    tenantId?: string;
    branchId?: string;
    terminalId?: string;
    posSessionId?: string;
    cashSessionId?: string;
    userId?: string;
    roles?: string[];
  };
};

@Controller("operations/sales")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class OperationalSalesController {
  constructor(
    @Inject(OperationalSalesService)
    private readonly service: OperationalSalesService
  ) {}

  @Get()
  @RequirePermission({
    menuKey: ["POS", "OPERATIONS_SALES"],
    level: "READ",
    operationalRoles: ["USER"],
  })
  list(@Query() query: OperationalSalesQueryDto, @Req() request: OperationalRequest) {
    return this.service.list(this.actor(request), query);
  }

  @Get(":saleId")
  @RequirePermission({
    menuKey: ["POS", "OPERATIONS_SALES"],
    level: "READ",
    operationalRoles: ["USER"],
  })
  detail(@Param("saleId") saleId: string, @Req() request: OperationalRequest) {
    return this.service.detail(this.actor(request), saleId);
  }

  @Post(":saleId/electronic-billing/refresh")
  @RequirePermission({ menuKey: "POS", level: "READ", operationalRoles: ["USER"] })
  refreshElectronicBillingStatus(@Param("saleId") saleId: string, @Req() request: OperationalRequest) {
    return this.service.refreshElectronicBillingStatus(this.actor(request), saleId);
  }

  @Post(":saleId/electronic-billing/retry")
  @RequirePermission({ menuKey: "POS", level: "WRITE" })
  retryElectronicBilling(@Param("saleId") saleId: string, @Req() request: OperationalRequest) {
    return this.service.retryElectronicBilling(this.actor(request), saleId);
  }

  @Post(":saleId/electronic-billing/recover-provider-create-intent")
  @RequirePermission({ menuKey: "POS", level: "WRITE" })
  recoverProviderCreateIntent(@Param("saleId") saleId: string, @Req() request: OperationalRequest) {
    return this.service.recoverProviderCreateIntent(this.actor(request), saleId);
  }

  @Patch(":saleId/customer")
  @RequirePermission({ menuKey: ["POS", "OPERATIONS_SALES"], level: "WRITE", operationalRoles: ["USER"] })
  updateCustomer(
    @Param("saleId") saleId: string,
    @Body() dto: UpdateSaleCustomerDto,
    @Req() request: OperationalRequest
  ) {
    return this.service.updateCustomer(this.actor(request), saleId, dto);
  }

  @Post(":saleId/payment-correction")
  @RequirePermission({ menuKey: ["POS", "OPERATIONS_SALES"], level: "WRITE", operationalRoles: ["USER"] })
  correctPayments(
    @Param("saleId") saleId: string,
    @Body() dto: CorrectSalePaymentsDto,
    @Req() request: OperationalRequest
  ) {
    return this.service.correctPayments(this.actor(request), saleId, dto);
  }

  @Post(":saleId/void")
  @RequirePermission({ menuKey: ["POS", "OPERATIONS_SALES"], level: "WRITE", operationalRoles: ["USER"] })
  voidSale(
    @Param("saleId") saleId: string,
    @Body() dto: VoidOperationalSaleDto,
    @Req() request: OperationalRequest
  ) {
    return this.service.voidSale(this.actor(request), saleId, dto);
  }

  @Post(":saleId/debit-note")
  @RequirePermission({ menuKey: ["POS", "OPERATIONS_SALES"], level: "WRITE", operationalRoles: ["USER"] })
  issueDebitNote(
    @Param("saleId") saleId: string,
    @Body() dto: OperationalDebitNoteDto,
    @Req() request: OperationalRequest
  ) {
    return this.service.issueDebitNote(this.actor(request), saleId, dto);
  }

  private actor(request: OperationalRequest) {
    const context = request.context;
    const tenantId = context?.tenantId ?? request.user?.tenantId;
    const userId = context?.userId ?? request.user?.id;
    if (!tenantId || !userId) {
      throw new Error("authenticated operational actor required");
    }
    return {
      id: userId,
      tenantId,
      roles: context?.roles ?? request.user?.roles ?? [],
      branchId: context?.branchId,
      terminalId: context?.terminalId,
      posSessionId: context?.posSessionId,
      cashSessionId: context?.cashSessionId,
    };
  }
}
