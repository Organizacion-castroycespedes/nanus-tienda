import {
  Body,
  Controller,
  Get,
  Inject,
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
import { CashMovementsService } from "./cash-movements.service";
import { CreateCashMovementDto } from "./dto/create-cash-movement.dto";
import { ListCashMovementsDto } from "./dto/list-cash-movements.dto";

@Controller("finance/cash-movements")
@UseGuards(JwtAuthGuard, RolesGuard, FinanceAuthzGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
@UsePipes(financeValidationPipe)
export class CashMovementsController {
  constructor(
    @Inject(CashMovementsService)
    private readonly cashMovementsService: CashMovementsService
  ) {}

  private buildActor(request: Request) {
    return (request as Request & FinanceAuthRequest).financeActor!;
  }

  @Get()
  list(@Query() query: ListCashMovementsDto, @Req() request: Request) {
    return this.cashMovementsService.list(query, this.buildActor(request));
  }

  @Post()
  create(@Body() payload: CreateCashMovementDto, @Req() request: Request) {
    return this.cashMovementsService.create(payload, this.buildActor(request));
  }
}
