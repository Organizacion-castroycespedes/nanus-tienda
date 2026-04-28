import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PosUserSessionsService } from "./pos-user-sessions.service";
import type { CreatePosSessionDto } from "./dto/create-pos-session.dto";

type AuthRequest = Request & {
  user?: {
    id?: string;
    tenantId?: string;
    roles?: string[];
    sessionId?: string;
  };
};

@Controller("pos/session")
@UseGuards(JwtAuthGuard)
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
  getCurrent(@Req() request: AuthRequest) {
    return this.posUserSessionsService.getCurrentSession(this.buildActor(request));
  }
}
