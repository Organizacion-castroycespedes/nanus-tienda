import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  Inject,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import {
  TenantsService,
  type TenantDetailsInput,
  type TenantSummaryInput,
} from "./tenants.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    roles?: string[];
  };
};

@Controller("tenants")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TenantsController {
  constructor(
    @Inject(TenantsService) private readonly tenantsService: TenantsService
  ) {}

  private ensureTenantScope(request: AuthRequest, tenantId: string) {
    const roles = Array.isArray(request.user?.roles) ? request.user.roles : [];
    if (roles.includes("SUPER_ADMIN")) {
      return;
    }
    if (!request.user?.tenantId || request.user.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant invalido");
    }
  }

  @Get()
  @Roles("SUPER_ADMIN")
  list() {
    return this.tenantsService.listTenants();
  }

  @Post()
  @Roles("SUPER_ADMIN")
  create(@Body() payload: Required<Pick<TenantSummaryInput, "slug">> & TenantSummaryInput) {
    return this.tenantsService.createTenant(payload);
  }

  @Put(":id")
  @Roles("SUPER_ADMIN")
  update(
    @Param("id") tenantId: string,
    @Body() payload: TenantSummaryInput
  ) {
    return this.tenantsService.updateTenant(tenantId, payload);
  }

  @Get(":id/config")
  getConfig(@Param("id") tenantId: string, @Req() request: AuthRequest) {
    this.ensureTenantScope(request, tenantId);
    return this.tenantsService.getConfig(tenantId);
  }

  @Put(":id/config")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  updateConfig(
    @Param("id") tenantId: string,
    @Body() body: { config: unknown },
    @Req() request: AuthRequest
  ) {
    this.ensureTenantScope(request, tenantId);
    return this.tenantsService.updateConfig(tenantId, body?.config ?? {});
  }

  @Get(":id/details")
  getDetails(@Param("id") tenantId: string, @Req() request: AuthRequest) {
    this.ensureTenantScope(request, tenantId);
    return this.tenantsService.getDetails(tenantId);
  }

  @Put(":id/details")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  upsertDetails(
    @Param("id") tenantId: string,
    @Body() body: TenantDetailsInput,
    @Req() request: AuthRequest
  ) {
    this.ensureTenantScope(request, tenantId);
    return this.tenantsService.upsertDetails(tenantId, body);
  }

  @Delete(":id/details")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  deleteDetails(@Param("id") tenantId: string, @Req() request: AuthRequest) {
    this.ensureTenantScope(request, tenantId);
    return this.tenantsService.deleteDetails(tenantId);
  }
}
