import {
  Body,
  Controller,
  Get,
  Inject,
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
import { ParametersService } from "./parameters.service";

type AuthRequest = Request & {
  user?: {
    id?: string;
    roles?: string[];
    tenantId?: string;
  };
  context?: {
    tenantId?: string;
    branchId?: string;
    terminalId?: string;
  };
};

@Controller("tenant-settings")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class TenantSettingsController {
  constructor(
    @Inject(ParametersService)
    private readonly parametersService: ParametersService
  ) {}

  private buildActor(request: AuthRequest) {
    return {
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      userId: request.user?.id,
      tenantId: request.user?.tenantId,
    };
  }

  @Get()
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "READ" })
  list(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("terminalId") terminalId: string | undefined,
    @Query("scope") scope: "tenant" | "branch" | "terminal" | undefined,
    @Req() request: AuthRequest
  ) {
    return this.parametersService.listTenantSettings(this.buildActor(request), {
      tenantId,
      branchId,
      terminalId,
      scope,
    });
  }

  @Get("resolve")
  async resolve(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("terminalId") terminalId: string | undefined,
    @Query("code") code: string | undefined,
    @Req() request: AuthRequest
  ) {
    const actor = this.buildActor(request);
    const effectiveTenantId = await this.parametersService.resolveTenantIdForActor(
      actor,
      tenantId?.trim() || request.context?.tenantId
    );
    const effectiveBranchId = branchId ?? request.context?.branchId ?? null;
    const effectiveTerminalId = terminalId ?? request.context?.terminalId ?? null;

    if (code?.trim()) {
      const value = await this.parametersService.resolveValue(
        code.trim().toUpperCase(),
        effectiveTenantId,
        effectiveBranchId,
        effectiveTerminalId
      );
      return { code: code.trim().toUpperCase(), value };
    }

    const values = await this.parametersService.resolveDocumentModes(
      effectiveTenantId,
      effectiveBranchId,
      effectiveTerminalId
    );
    return { values };
  }

  @Put()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  upsert(
    @Body()
    payload: {
      tenantId?: string;
      branchId?: string | null;
      terminalId?: string | null;
      parameterId?: string;
      parameterCode?: string;
      value: string;
    },
    @Req() request: AuthRequest
  ) {
    return this.parametersService.upsertTenantSetting(
      this.buildActor(request),
      payload
    );
  }
}
