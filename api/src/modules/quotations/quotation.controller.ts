import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { QUOTATION_ACTIONS } from "./quotation.policy";
import {
  QuotationService,
  type QuotationActor,
  type QuotationInput,
  type QuotationListQuery,
} from "./quotation.service";

type AuthRequest = Request & {
  user?: { tenantId?: string; id?: string; roles?: string[] };
  context?: {
    tenantId?: string;
    branchId?: string;
    terminalId?: string;
    posSessionId?: string;
    userId?: string;
    cashSessionId?: string;
  };
};

const uuid = new ParseUUIDPipe();

@Controller("quotations")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class QuotationController {
  constructor(@Inject(QuotationService) private readonly quotationService: QuotationService) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private buildActor(request: AuthRequest): QuotationActor {
    return {
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      userId: request.context?.userId ?? request.user?.id,
      tenantId: this.getTenantId(request),
      branchId: request.context?.branchId,
      terminalId: request.context?.terminalId,
      cashSessionId: request.context?.cashSessionId,
    };
  }

  private getInventoryContext(request: AuthRequest) {
    return {
      tenantId: this.getTenantId(request),
      branchId: request.context?.branchId ?? null,
      terminalId: request.context?.terminalId ?? null,
      posSessionId: request.context?.posSessionId ?? null,
      userId: request.context?.userId ?? request.user?.id ?? null,
      cashSessionId: request.context?.cashSessionId ?? null,
    };
  }

  @Get("settings")
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "READ", action: QUOTATION_ACTIONS.VIEW })
  getSettings(@Req() request: AuthRequest) {
    return this.quotationService.getSettings(this.buildActor(request));
  }

  @Put("settings")
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "WRITE", action: QUOTATION_ACTIONS.SETTINGS })
  updateSettings(@Body() body: { defaultValidityDays?: unknown }, @Req() request: AuthRequest) {
    return this.quotationService.updateSettings(body ?? {}, this.buildActor(request));
  }

  @Get()
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "READ", action: QUOTATION_ACTIONS.VIEW })
  list(@Query() query: QuotationListQuery, @Req() request: AuthRequest) {
    return this.quotationService.list(query ?? {}, this.buildActor(request));
  }

  @Get(":id")
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "READ", action: QUOTATION_ACTIONS.VIEW })
  getById(@Param("id", uuid) id: string, @Req() request: AuthRequest) {
    return this.quotationService.getById(id, this.buildActor(request));
  }

  @Post()
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "WRITE", action: QUOTATION_ACTIONS.CREATE })
  create(@Body() body: QuotationInput, @Req() request: AuthRequest) {
    return this.quotationService.create(body, this.buildActor(request));
  }

  @Put(":id")
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "WRITE", action: QUOTATION_ACTIONS.UPDATE })
  update(@Param("id", uuid) id: string, @Body() body: QuotationInput, @Req() request: AuthRequest) {
    return this.quotationService.update(id, body, this.buildActor(request));
  }

  @Post(":id/send")
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "WRITE", action: QUOTATION_ACTIONS.UPDATE })
  send(@Param("id", uuid) id: string, @Req() request: AuthRequest) {
    return this.quotationService.send(id, this.buildActor(request));
  }

  @Post(":id/send-email")
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "WRITE", action: QUOTATION_ACTIONS.UPDATE })
  sendEmail(
    @Param("id", uuid) id: string,
    @Body() body: { to?: unknown; message?: unknown },
    @Req() request: AuthRequest
  ) {
    const authorization = request.headers.authorization;
    return this.quotationService.sendByEmail(
      id,
      body ?? {},
      this.buildActor(request),
      typeof authorization === "string" ? authorization : undefined
    );
  }

  @Post(":id/approve")
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "WRITE", action: QUOTATION_ACTIONS.APPROVE })
  approve(@Param("id", uuid) id: string, @Req() request: AuthRequest) {
    return this.quotationService.approve(id, this.buildActor(request));
  }

  @Post(":id/reject")
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "WRITE", action: QUOTATION_ACTIONS.APPROVE })
  reject(
    @Param("id", uuid) id: string,
    @Body() body: { reason?: unknown },
    @Req() request: AuthRequest
  ) {
    return this.quotationService.reject(id, body?.reason, this.buildActor(request));
  }

  @Post(":id/renew")
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "WRITE", action: QUOTATION_ACTIONS.UPDATE })
  renew(@Param("id", uuid) id: string, @Req() request: AuthRequest) {
    return this.quotationService.renew(id, this.buildActor(request));
  }

  @Post(":id/duplicate")
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "WRITE", action: QUOTATION_ACTIONS.CREATE })
  duplicate(@Param("id", uuid) id: string, @Req() request: AuthRequest) {
    return this.quotationService.duplicate(id, this.buildActor(request));
  }

  @Post(":id/convert-to-order")
  @RequirePermission({ menuKey: MENU_KEYS.QUOTATIONS, level: "WRITE", action: QUOTATION_ACTIONS.CONVERT })
  convertToOrder(
    @Param("id", uuid) id: string,
    @Body() body: { type?: unknown },
    @Req() request: AuthRequest
  ) {
    return this.quotationService.convertToOrder(
      id,
      body ?? {},
      this.buildActor(request),
      this.getInventoryContext(request)
    );
  }
}
