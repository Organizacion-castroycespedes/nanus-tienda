import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TerminalRuntimeService } from "./terminal-runtime.service";
import type { ResolveTerminalRuntimeDto } from "./dto/resolve-terminal-runtime.dto";

type AuthenticatedRequest = Request & {
  user?: { tenantId?: string };
};

@Controller("terminal-runtime")
@UseGuards(JwtAuthGuard)
export class TerminalRuntimeController {
  constructor(
    @Inject(TerminalRuntimeService)
    private readonly service: TerminalRuntimeService,
  ) {}

  @Post("resolve")
  resolve(
    @Body() payload: ResolveTerminalRuntimeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.resolve(payload, { tenantId: request.user?.tenantId });
  }
}
