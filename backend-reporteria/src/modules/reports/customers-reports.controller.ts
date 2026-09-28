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
import { ReportRoles } from "../auth/report-roles.decorator";
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

  @Get()
  @ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  async getCustomerMaster(
    @Query()
    query: {
      tenantId?: string;
      customerDocument?: string;
      customerName?: string;
      format?: string;
    },
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const format = (query.format ?? "json").toLowerCase();
    if (format === "pdf" || format === "xlsx") {
      const document = format === "pdf"
        ? await this.customersReportsService.getCustomerMasterPdf(query, request.user)
        : await this.customersReportsService.getCustomerMasterExcel(query, request.user);
      response.setHeader(
        "Content-Type",
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      response.setHeader(
        "Content-Disposition",
        `${format === "pdf" ? "inline" : "attachment"}; filename="reporte-clientes.${format}"`,
      );
      response.setHeader("Content-Length", document.length);
      response.end(document);
      return;
    }

    response.json(await this.customersReportsService.getCustomerMaster(query, request.user));
  }

  @Get("orders-status")
  @ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
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
