import {
  Controller,
  Get,
  Inject,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { OperationalSalesReportAuthGuard } from "../auth/operational-sales-report-auth.guard";
import { ReportAuthzGuard } from "../auth/report-authz.guard";
import { ReportRoles } from "../auth/report-roles.decorator";
import type { ReportUser } from "../auth/report-auth.types";
import { OperationalSalesReportsService } from "./operational-sales-reports.service";
import type { OperationalSalesReportQuery } from "./types/operational-sales-report.types";

type AuthenticatedRequest = Request & { user?: ReportUser };
@Controller("reports/operational-sales")
@UseGuards(OperationalSalesReportAuthGuard, ReportAuthzGuard)
@ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
export class OperationalSalesReportsController {
  constructor(
  @Inject(OperationalSalesReportsService)
  private readonly service: OperationalSalesReportsService,
) {}

  @Get()
  async get(@Query() query: OperationalSalesReportQuery & { format?: string }, @Req() request: AuthenticatedRequest, @Res() response: Response) {
    const format = query.format === "xlsx" ? "xlsx" : query.format === "pdf" ? "pdf" : null;
    if (!format) return response.status(400).json({ message: "format must be pdf or xlsx" });
    const posSessionHeader = request.headers["x-pos-session-id"];
    const posSessionId = Array.isArray(posSessionHeader) ? posSessionHeader[0] : posSessionHeader;
    const document = format === "pdf" ? await this.service.getPdf(query, request.user, posSessionId) : await this.service.getExcel(query, request.user, posSessionId);
    response.setHeader("Content-Type", format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition", `${format === "pdf" ? "inline" : "attachment"}; filename="reporte-ventas-operativas.${format}"`);
    response.setHeader("Content-Length", document.length); response.end(document);
  }
}
