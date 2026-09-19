import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReportAuthzGuard } from "../auth/report-authz.guard";
import type { ReportUser } from "../auth/report-auth.types";
import { ProductInventoryReportsService, type ProductInventoryQuery } from "./product-inventory-reports.service";

type AuthenticatedRequest = Request & { user?: ReportUser };
type ReportRequest = ProductInventoryQuery & { mode?: "preview" | "export" };

@Controller("reports/product-inventory")
@UseGuards(JwtAuthGuard, ReportAuthzGuard)
export class ProductInventoryReportsController {
  constructor(@Inject(ProductInventoryReportsService)
    private readonly reports: ProductInventoryReportsService) {}

  @Post()
  async getReport(
    @Body() filters: ReportRequest,
    @Req() request: AuthenticatedRequest
  ) {
    const { mode = "preview", ...query } = filters;
    return mode === "export"
      ? this.reports.createPackage(query, request.user)
      : this.reports.createPreviewPackage(query, request.user);
  }
}
