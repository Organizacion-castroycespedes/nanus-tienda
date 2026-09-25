import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
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
};

@Controller("parameters")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
export class ParametersController {
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
    @Query("includeInactive") includeInactive: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.parametersService.listParameters(
      this.buildActor(request),
      includeInactive === "true"
    );
  }

  @Post()
  @Roles("SUPER_ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  create(
    @Body()
    payload: {
      code: string;
      valueType: "MODE" | "BOOLEAN";
      defaultValue: string;
      label: string;
      active?: boolean;
    },
    @Req() request: AuthRequest
  ) {
    return this.parametersService.createParameter(this.buildActor(request), payload);
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  update(
    @Param("id") parameterId: string,
    @Body()
    payload: {
      label?: string;
      defaultValue?: string;
      active?: boolean;
    },
    @Req() request: AuthRequest
  ) {
    return this.parametersService.updateParameter(
      this.buildActor(request),
      parameterId,
      payload
    );
  }
}
