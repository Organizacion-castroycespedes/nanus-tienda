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
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReportAuthzGuard } from "../auth/report-authz.guard";
import type { ReportUser } from "../auth/report-auth.types";
import { CustomersReportsService } from "./customers-reports.service";

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

@Controller("reports/customers")
@UseGuards(JwtAuthGuard, ReportAuthzGuard)
export class CustomersReportsController {
  constructor(
    @Inject(CustomersReportsService)
    private readonly customersReportsService: CustomersReportsService
  ) {}

  @Get("orders-status")
  async getCustomerOrdersStatus(
    @Query()
    query: {
      tenantId?: string;
      branchId?: string;
      dateFrom?: string;
      dateTo?: string;
      customerDocument?: string;
      customerName?: string;
      format?: string;
    },
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    if ((query.format ?? "json").toLowerCase() === "pdf") {
      const pdfBuffer = await this.customersReportsService.getCustomerOrdersStatusPdf(
        query,
        request.user
      );

      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        'inline; filename="reporte-clientes-pedidos.pdf"'
      );
      response.setHeader("Content-Length", pdfBuffer.length);
      response.end(pdfBuffer);
      return;
    }

    response.json(
      await this.customersReportsService.getCustomerOrdersStatus(query, request.user)
    );
  }
}
