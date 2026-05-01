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
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { ListPaymentsDto } from "./dto/list-payments.dto";
import { PaymentsService } from "./payments.service";

@Controller("finance/payments")
@UseGuards(JwtAuthGuard, RolesGuard, FinanceAuthzGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
@UsePipes(financeValidationPipe)
export class PaymentsController {
  constructor(
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService
  ) {}

  private buildActor(request: Request) {
    return (request as Request & FinanceAuthRequest).financeActor!;
  }

  @Get()
  list(@Query() query: ListPaymentsDto, @Req() request: Request) {
    return this.paymentsService.list(query, this.buildActor(request));
  }

  @Get(":id")
  getById(@Param("id") paymentId: string, @Req() request: Request) {
    return this.paymentsService.getById(paymentId, this.buildActor(request));
  }

  @Post()
  create(@Body() payload: CreatePaymentDto, @Req() request: Request) {
    return this.paymentsService.create(payload, this.buildActor(request));
  }
}
