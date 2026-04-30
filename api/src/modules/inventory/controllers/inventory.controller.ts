import {
  Controller,
  Get,
  Inject,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { InventoryService } from "../services/inventory.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    roles?: string[];
  };
  context?: {
    tenantId?: string;
    branchId?: string;
  };
};

@Controller("inventory")
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService
  ) {}

  private buildActor(request: AuthRequest) {
    return {
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      tenantId: request.context?.tenantId ?? request.user?.tenantId,
      branchId: request.context?.branchId,
    };
  }

  @Get("products")
  listProducts(
    @Query("tenantId") tenantId: string | undefined,
    @Query("branchId") branchId: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.inventoryService.listInventoryProducts(
      {
        tenantId,
        branchId,
      },
      this.buildActor(request)
    );
  }
}
