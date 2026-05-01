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
  UsePipes,
} from "@nestjs/common";
import type { Request } from "express";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import type { FinanceAuthRequest } from "../common/finance.types";
import { FinanceAuthzGuard } from "../common/guards/finance-authz.guard";
import { financeValidationPipe } from "../common/pipes/finance-validation.pipe";
import { CashSessionsService } from "./cash-sessions.service";
import { CloseCashSessionDto } from "./dto/close-cash-session.dto";
import { CurrentCashSessionQueryDto } from "./dto/current-cash-session-query.dto";
import { ListCashSessionHistoryDto } from "./dto/list-cash-session-history.dto";
import { OpenCashSessionDto } from "./dto/open-cash-session.dto";

@Controller("finance/cash-sessions")
@UseGuards(JwtAuthGuard, RolesGuard, FinanceAuthzGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
@UsePipes(financeValidationPipe)
export class CashSessionsController {
  constructor(
    @Inject(CashSessionsService)
    private readonly cashSessionsService: CashSessionsService
  ) {}

  private buildActor(request: Request) {
    return (request as Request & FinanceAuthRequest).financeActor!;
  }

  @Post("open")
  open(@Body() payload: OpenCashSessionDto, @Req() request: Request) {
    return this.cashSessionsService.open(payload, this.buildActor(request));
  }

  @Post(":id/close")
  close(
    @Param("id") cashSessionId: string,
    @Body() payload: CloseCashSessionDto,
    @Req() request: Request
  ) {
    return this.cashSessionsService.close(
      cashSessionId,
      payload,
      this.buildActor(request)
    );
  }

  @Get("current")
  getCurrent(
    @Query() query: CurrentCashSessionQueryDto,
    @Req() request: Request
  ) {
    return this.cashSessionsService.getCurrent(query, this.buildActor(request));
  }

  @Get("history")
  getHistory(
    @Query() query: ListCashSessionHistoryDto,
    @Req() request: Request
  ) {
    return this.cashSessionsService.getHistory(query, this.buildActor(request));
  }
}
