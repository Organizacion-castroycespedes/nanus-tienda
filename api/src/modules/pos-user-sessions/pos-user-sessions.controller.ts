import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PosUserSessionsService } from "./pos-user-sessions.service";
import type { CreatePosSessionDto } from "./dto/create-pos-session.dto";
import type { ListPosSessionsDto } from "./dto/list-pos-sessions.dto";
import type { ClosePosSessionDto } from "./dto/close-pos-session.dto";

type AuthRequest = Request & {
  user?: {
    id?: string;
    tenantId?: string;
    roles?: string[];
    sessionId?: string;
  };
};

@Controller("pos/session")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class PosUserSessionsController {
  constructor(
    @Inject(PosUserSessionsService)
    private readonly posUserSessionsService: PosUserSessionsService
  ) {}

  private buildActor(request: AuthRequest) {
    return {
      userId: request.user?.id,
      tenantId: request.user?.tenantId,
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      sessionId: request.user?.sessionId,
    };
  }

  @Post()
  @RequirePermission({ menuKey: "POS", level: "WRITE" })
  async create(@Body() payload: CreatePosSessionDto, @Req() request: AuthRequest) {
    const posSession = await this.posUserSessionsService.createPosSession(
      payload,
      this.buildActor(request)
    );

    return {
      posSessionId: posSession?.id,
      branchId: posSession?.branch_id,
      terminalId: posSession?.terminal_id,
    };
  }

  @Get("current")
  @RequirePermission({ menuKey: "POS", level: "READ" })
  getCurrent(@Req() request: AuthRequest) {
    return this.posUserSessionsService.getCurrentSession(this.buildActor(request));
  }

  @Get("active")
  @Roles("SUPER_ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "READ" })
  listActive(@Query() query: ListPosSessionsDto, @Req() request: AuthRequest) {
    return this.posUserSessionsService.listActiveForTerminal(query, this.buildActor(request));
  }

  @Post(":id/close")
  @Roles("SUPER_ADMIN")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "WRITE" })
  close(
    @Param("id") sessionId: string,
    @Body() payload: ClosePosSessionDto,
    @Req() request: AuthRequest,
  ) {
    return this.posUserSessionsService.closeOne(sessionId, payload, this.buildActor(request));
  }
}
