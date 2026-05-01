import {
  Body,
  Controller,
  Delete,
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
import { FinanceAuthzGuard } from "../common/guards/finance-authz.guard";
import { financeValidationPipe } from "../common/pipes/finance-validation.pipe";
import type { FinanceAuthRequest } from "../common/finance.types";
import { CreatePaymentMethodDto } from "./dto/create-payment-method.dto";
import { ListPaymentMethodsDto } from "./dto/list-payment-methods.dto";
import { UpdatePaymentMethodDto } from "./dto/update-payment-method.dto";
import { PaymentMethodsService } from "./payment-methods.service";

@Controller("finance/payment-methods")
@UseGuards(JwtAuthGuard, RolesGuard, FinanceAuthzGuard)
@Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
@UsePipes(financeValidationPipe)
export class PaymentMethodsController {
  constructor(
    @Inject(PaymentMethodsService)
    private readonly paymentMethodsService: PaymentMethodsService
  ) {}

  private buildActor(request: Request) {
    return (request as Request & FinanceAuthRequest).financeActor!;
  }

  @Get()
  list(
    @Query() query: ListPaymentMethodsDto,
    @Req() request: Request
  ) {
    return this.paymentMethodsService.list(query, this.buildActor(request));
  }

  @Post()
  create(
    @Body() payload: CreatePaymentMethodDto,
    @Req() request: Request
  ) {
    return this.paymentMethodsService.create(payload, this.buildActor(request));
  }

  @Patch(":id")
  update(
    @Param("id") paymentMethodId: string,
    @Body() payload: UpdatePaymentMethodDto,
    @Req() request: Request
  ) {
    return this.paymentMethodsService.update(
      paymentMethodId,
      payload,
      this.buildActor(request)
    );
  }

  @Delete(":id")
  remove(@Param("id") paymentMethodId: string, @Req() request: Request) {
    return this.paymentMethodsService.remove(
      paymentMethodId,
      this.buildActor(request)
    );
  }
}
