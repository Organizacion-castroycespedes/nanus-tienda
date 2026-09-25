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
  UsePipes,
} from "@nestjs/common";
import type { Request } from "express";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import type { FinanceAuthRequest } from "../common/finance.types";
import { FinanceAuthzGuard } from "../common/guards/finance-authz.guard";
import { financeValidationPipe } from "../common/pipes/finance-validation.pipe";
import { CashRegistersService } from "./cash-registers.service";
import { CreateCashRegisterDto } from "./dto/create-cash-register.dto";
import { ListCashRegistersDto } from "./dto/list-cash-registers.dto";
import { UpdateCashRegisterDto } from "./dto/update-cash-register.dto";

@Controller("finance/cash-registers")
@UseGuards(JwtAuthGuard, RolesGuard, FinanceAuthzGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
@UsePipes(financeValidationPipe)
export class CashRegistersController {
  constructor(
    @Inject(CashRegistersService)
    private readonly cashRegistersService: CashRegistersService
  ) {}

  private buildActor(request: Request) {
    return (request as Request & FinanceAuthRequest).financeActor!;
  }

  @Get()
  list(@Query() query: ListCashRegistersDto, @Req() request: Request) {
    return this.cashRegistersService.list(query, this.buildActor(request));
  }

  @Post()
  create(@Body() payload: CreateCashRegisterDto, @Req() request: Request) {
    return this.cashRegistersService.create(payload, this.buildActor(request));
  }

  @Patch(":id")
  update(
    @Param("id") cashRegisterId: string,
    @Body() payload: UpdateCashRegisterDto,
    @Req() request: Request
  ) {
    return this.cashRegistersService.update(
      cashRegisterId,
      payload,
      this.buildActor(request)
    );
  }

  @Get(":id/assignments")
  listAssignments(@Param("id") cashRegisterId: string, @Req() request: Request) {
    return this.cashRegistersService.listAssignments(
      cashRegisterId,
      this.buildActor(request)
    );
  }

  @Post(":id/assignments")
  assignUser(
    @Param("id") cashRegisterId: string,
    @Body() payload: { userId?: string },
    @Req() request: Request
  ) {
    return this.cashRegistersService.assignUser(
      cashRegisterId,
      String(payload.userId ?? ""),
      this.buildActor(request)
    );
  }

  @Patch(":id/assignments/:userId/unassign")
  unassignUser(
    @Param("id") cashRegisterId: string,
    @Param("userId") userId: string,
    @Req() request: Request
  ) {
    return this.cashRegistersService.unassignUser(
      cashRegisterId,
      userId,
      this.buildActor(request)
    );
  }
}
