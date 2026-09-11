import {
  Controller,
  Get,
  Inject,
  Param,
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
import { SalesReportsService } from "./sales-reports.service";
import type { PosSaleTicketPrintDataset } from "./types/sales-report.types";

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

@Controller("reports/pos-sales")
@UseGuards(JwtAuthGuard, ReportAuthzGuard)
export class SalesReportsController {
  constructor(
    @Inject(SalesReportsService)
    private readonly salesReportsService: SalesReportsService
  ) {}

  @Get()
  async getSalesList(
    @Query()
    query: {
      tenantId?: string;
      branchId?: string;
      dateFrom?: string;
      dateTo?: string;
      format?: string;
    },
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    if ((query.format ?? "json").toLowerCase() === "pdf") {
      const pdfBuffer = await this.salesReportsService.getSalesListPdf(query, request.user);

      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        'inline; filename="reporte-ventas-pos.pdf"'
      );
      response.setHeader("Content-Length", pdfBuffer.length);
      response.end(pdfBuffer);
      return;
    }

    response.json(await this.salesReportsService.getSalesList(query, request.user));
  }

  @Get(":saleId/ticket")
  @ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  async getSaleTicket(
    @Param("saleId") saleId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const pdfBuffer = await this.salesReportsService.getSaleTicketPdf(
      saleId,
      request.user
    );

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `inline; filename="ticket-venta-${saleId}.pdf"`
    );
    response.setHeader("Content-Length", pdfBuffer.length);
    response.end(pdfBuffer);
  }

  @Get(":saleId/ticket-data")
  @ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  getSaleTicketData(
    @Param("saleId") saleId: string,
    @Req() request: AuthenticatedRequest
  ): Promise<PosSaleTicketPrintDataset> {
    return this.salesReportsService.getSaleTicketPrintData(
      saleId,
      request.user
    );
  }

  @Get(":saleId/electronic-invoice")
  @ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  async getElectronicInvoice(
    @Param("saleId") saleId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const pdfBuffer = await this.salesReportsService.getElectronicInvoicePdf(
      saleId,
      request.user
    );
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `inline; filename="factura-electronica-${saleId}.pdf"`
    );
    response.setHeader("Content-Length", pdfBuffer.length);
    response.end(pdfBuffer);
  }

  @Get(":saleId/electronic-invoice-data")
  @ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  getElectronicInvoiceData(
    @Param("saleId") saleId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.salesReportsService.getElectronicInvoice(saleId, request.user);
  }

  @Get(":saleId/cancel-ticket")
  async getSaleCancelTicket(
    @Param("saleId") saleId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const pdfBuffer = await this.salesReportsService.getSaleCancelTicketPdf(
      saleId,
      request.user
    );

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `inline; filename="ticket-cancelacion-${saleId}.pdf"`
    );
    response.setHeader("Content-Length", pdfBuffer.length);
    response.end(pdfBuffer);
  }
}
