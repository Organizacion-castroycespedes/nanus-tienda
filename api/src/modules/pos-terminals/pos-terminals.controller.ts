import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
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
import {
  PosTerminalsService,
  type CreatePosTerminalDto,
  type PosTerminalSettingsDto,
  type UpdatePosTerminalDto,
} from "./pos-terminals.service";

type AuthRequest = Request & {
  user?: {
    roles?: string[];
    tenantId?: string;
    id?: string;
  };
};

@Controller("pos-terminals")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class PosTerminalsController {
  constructor(
    @Inject(PosTerminalsService)
    private readonly service: PosTerminalsService
  ) {}

  private buildActor(request: AuthRequest) {
    return {
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      tenantId: request.user?.tenantId,
      userId: request.user?.id,
    };
  }

  @Get("resolve-current")
  resolveCurrent(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Query("terminalId") terminalId: string | undefined,
    @Query("terminalCode") terminalCode: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.service.resolveCurrent(
      { tenantId, branchId, terminalId, terminalCode },
      this.buildActor(request)
    );
  }

  @Get()
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: MENU_KEYS.POS_PERIPHERALS, level: "READ" })
  list(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.service.listTerminals(
      { tenantId, branchId },
      this.buildActor(request)
    );
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: MENU_KEYS.POS_PERIPHERALS, level: "READ" })
  get(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.service.getTerminal(id, this.buildActor(request));
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: MENU_KEYS.POS_PERIPHERALS, level: "WRITE" })
  create(@Body() payload: CreatePosTerminalDto, @Req() request: AuthRequest) {
    return this.service.createTerminal(payload, this.buildActor(request));
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: MENU_KEYS.POS_PERIPHERALS, level: "WRITE" })
  update(
    @Param("id") id: string,
    @Body() payload: UpdatePosTerminalDto,
    @Req() request: AuthRequest
  ) {
    return this.service.updateTerminal(id, payload, this.buildActor(request));
  }

  @Get(":id/peripherals")
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: MENU_KEYS.POS_PERIPHERALS, level: "READ" })
  getPeripheralSettings(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.service.getPeripheralSettings(id, this.buildActor(request));
  }

  @Put(":id/peripherals")
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: MENU_KEYS.POS_PERIPHERALS, level: "WRITE" })
  savePeripheralSettings(
    @Param("id") id: string,
    @Body() payload: PosTerminalSettingsDto,
    @Req() request: AuthRequest
  ) {
    return this.service.savePeripheralSettings(
      id,
      payload,
      this.buildActor(request)
    );
  }
}
