import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { TaxService } from "../services/tax.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
  };
};

type CreateTaxBody = {
  name: string;
  rate: number;
  isIncluded: boolean;
  isActive?: boolean;
};

type UpdateTaxBody = Partial<CreateTaxBody>;

@Controller("taxes")
@UseGuards(JwtAuthGuard)
export class TaxController {
  constructor(
    @Inject(TaxService)
    private readonly taxService: TaxService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  @Get()
  list(@Req() request: AuthRequest) {
    return this.taxService.listTaxes(this.getTenantId(request));
  }

  @Post()
  create(@Body() body: CreateTaxBody, @Req() request: AuthRequest) {
    return this.taxService.createTax({
      tenantId: this.getTenantId(request),
      name: body.name,
      rate: Number(body.rate),
      isIncluded: Boolean(body.isIncluded),
      isActive: body.isActive,
    });
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateTaxBody,
    @Req() request: AuthRequest
  ) {
    return this.taxService.updateTax(id, this.getTenantId(request), {
      name: body.name,
      rate: body.rate !== undefined ? Number(body.rate) : undefined,
      isIncluded: body.isIncluded,
      isActive: body.isActive,
    });
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.taxService.deleteTax(id, this.getTenantId(request));
  }
}
