import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { InventoryReadReportGuard } from "../auth/inventory-read-report.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReportAuthzGuard } from "../auth/report-authz.guard";
import type { ReportUser } from "../auth/report-auth.types";
import { InventoryBiValuationReportsService, type InventoryValuationExportRequest } from "./inventory-bi-valuation-reports.service";

type AuthenticatedRequest = Request & { user?: ReportUser };

@Controller("reports/inventory-bi-valuation")
@UseGuards(JwtAuthGuard, ReportAuthzGuard, InventoryReadReportGuard)
export class InventoryBiValuationReportsController {
  constructor(@Inject(InventoryBiValuationReportsService)
    private readonly reports: InventoryBiValuationReportsService) {}

  @Post()
  create(
    @Body() body: InventoryValuationExportRequest,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reports.createPackage(body, request.user);
  }
}
