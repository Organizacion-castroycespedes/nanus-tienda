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
import { TerminalsService } from "./terminals.service";
import type { CreateTerminalDto } from "./dto/create-terminal.dto";
import type { UpdateTerminalDto } from "./dto/update-terminal.dto";

type AuthRequest = Request & {
  user?: {
    roles?: string[];
    tenantId?: string;
    id?: string;
  };
};

type UpdateTerminalStatusDto = {
  isActive: boolean;
};

@Controller("terminals")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN")
export class TerminalsController {
  constructor(
    @Inject(TerminalsService)
    private readonly terminalsService: TerminalsService
  ) {}

  private buildActor(request: AuthRequest) {
    const roles = Array.isArray(request.user?.roles)
      ? request.user.roles
      : [];
    return {
      roles,
      tenantId: request.user?.tenantId,
      userId: request.user?.id,
    };
  }

  @Post()
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "WRITE" })
  create(@Body() payload: CreateTerminalDto, @Req() request: AuthRequest) {
    return this.terminalsService.createTerminal(
      payload,
      this.buildActor(request)
    );
  }

  @Get()
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "READ" })
  list(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.terminalsService.listTerminals(
      {
        tenantId,
        branchId,
      },
      this.buildActor(request)
    );
  }

  @Patch(":id")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "WRITE" })
  update(
    @Param("id") terminalId: string,
    @Body() payload: UpdateTerminalDto,
    @Req() request: AuthRequest
  ) {
    return this.terminalsService.updateTerminal(
      terminalId,
      payload,
      this.buildActor(request)
    );
  }

  @Patch(":id/status")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "WRITE" })
  updateStatus(
    @Param("id") terminalId: string,
    @Body() payload: UpdateTerminalStatusDto,
    @Req() request: AuthRequest
  ) {
    return this.terminalsService.updateStatus(
      terminalId,
      payload.isActive,
      this.buildActor(request)
    );
  }
}
