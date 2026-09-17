import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
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
import { AccessControlService } from "../../common/services/access-control.service";
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
    @Inject(TenantsService) private readonly tenantsService: TenantsService,
    @Inject(AccessControlService) private readonly accessControl: AccessControlService,
  ) {}

  private async resolveTenantRoute(request: AuthRequest, tenant: string) {
    return this.accessControl.resolveTenantIdFromRoute(
      {
        tenantId: request.user?.tenantId,
        roles: request.user?.roles,
      },
      tenant,
    );
  }

  @Get()
  @Roles("SUPER_ADMIN", "SUPER_USER")
  list(
    @Query("tenantId") tenantId: string | undefined,
    @Req() request: AuthRequest
  ) {
    const roles = Array.isArray(request.user?.roles) ? request.user.roles : [];
    if (roles.includes("SUPER_ADMIN")) {
      return this.tenantsService.listTenants(tenantId);
    }
    if (!request.user?.tenantId) {
      throw new ForbiddenException("Tenant requerido");
    }
    if (tenantId && tenantId.trim() !== request.user.tenantId) {
      throw new ForbiddenException("Tenant invalido");
    }
    return this.tenantsService.listTenants(request.user.tenantId);
  }

  @Post()
  @Roles("SUPER_ADMIN")
  create(@Body() payload: TenantSummaryInput) {
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
  async getConfig(@Param("id") tenant: string, @Req() request: AuthRequest) {
    const tenantId = await this.resolveTenantRoute(request, tenant);
    return this.tenantsService.getConfig(tenantId);
  }

  @Put(":id/config")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  async updateConfig(
    @Param("id") tenant: string,
    @Body() body: { config: unknown },
    @Req() request: AuthRequest
  ) {
    const tenantId = await this.resolveTenantRoute(request, tenant);
    return this.tenantsService.updateConfig(tenantId, body?.config ?? {});
  }

  @Get(":id/details")
  async getDetails(@Param("id") tenant: string, @Req() request: AuthRequest) {
    const tenantId = await this.resolveTenantRoute(request, tenant);
    return this.tenantsService.getDetails(tenantId);
  }

  @Put(":id/details")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  async upsertDetails(
    @Param("id") tenant: string,
    @Body() body: TenantDetailsInput,
    @Req() request: AuthRequest
  ) {
    const tenantId = await this.resolveTenantRoute(request, tenant);
    return this.tenantsService.upsertDetails(tenantId, body);
  }

  @Delete(":id/details")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  async deleteDetails(@Param("id") tenant: string, @Req() request: AuthRequest) {
    const tenantId = await this.resolveTenantRoute(request, tenant);
    return this.tenantsService.deleteDetails(tenantId);
  }
}
