import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
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
import { CreateFinancialInstitutionDto } from "./dto/create-financial-institution.dto";
import { UpdateFinancialInstitutionDto } from "./dto/update-financial-institution.dto";
import { FinancialInstitutionsService } from "./financial-institutions.service";

@Controller("finance/financial-institutions")
@UseGuards(JwtAuthGuard, RolesGuard, FinanceAuthzGuard)
@UsePipes(financeValidationPipe)
export class FinancialInstitutionsController {
  constructor(
    @Inject(FinancialInstitutionsService)
    private readonly financialInstitutionsService: FinancialInstitutionsService
  ) {}

  private buildActor(request: Request) {
    return (request as Request & FinanceAuthRequest).financeActor!;
  }

  @Get()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  list(
    @Query("paymentMethodId") paymentMethodId: string | undefined,
    @Query("active") active: string | undefined,
    @Req() request: Request
  ) {
    return this.financialInstitutionsService.list(
      this.buildActor(request),
      paymentMethodId,
      active === "all" ? undefined : active === undefined ? true : active === "true"
    );
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  create(
    @Body() payload: CreateFinancialInstitutionDto,
    @Req() request: Request
  ) {
    return this.financialInstitutionsService.create(payload, this.buildActor(request));
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  update(
    @Param("id") id: string,
    @Body() payload: UpdateFinancialInstitutionDto,
    @Req() request: Request
  ) {
    return this.financialInstitutionsService.update(id, payload, this.buildActor(request));
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "SUPER_USER")
  remove(@Param("id") id: string, @Req() request: Request) {
    return this.financialInstitutionsService.remove(id, this.buildActor(request));
  }

  @Put("mappings/:paymentMethodId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN")
  setPaymentMethodMappings(
    @Param("paymentMethodId") paymentMethodId: string,
    @Body("financialInstitutionIds") financialInstitutionIds: string[],
    @Req() request: Request
  ) {
    return this.financialInstitutionsService.setPaymentMethodMappings(
      paymentMethodId,
      financialInstitutionIds ?? [],
      this.buildActor(request)
    );
  }
}
