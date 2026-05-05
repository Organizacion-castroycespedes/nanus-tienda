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
import type { ReportUser } from "../auth/report-auth.types";
import { PurchasesReportsService } from "./purchases-reports.service";

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

@Controller("reports/purchases")
@UseGuards(JwtAuthGuard, ReportAuthzGuard)
export class PurchasesReportsController {
  constructor(
    @Inject(PurchasesReportsService)
    private readonly purchasesReportsService: PurchasesReportsService
  ) {}

  @Get()
  async getPurchases(
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
      const pdfBuffer = await this.purchasesReportsService.getPurchasesPdf(query, request.user);

      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        'inline; filename="reporte-compras.pdf"'
      );
      response.setHeader("Content-Length", pdfBuffer.length);
      response.end(pdfBuffer);
      return;
    }

    response.json(await this.purchasesReportsService.getPurchases(query, request.user));
  }

  @Get(":purchaseId/ticket")
  async getPurchaseTicket(
    @Param("purchaseId") purchaseId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const pdfBuffer = await this.purchasesReportsService.getPurchaseTicketPdf(
      purchaseId,
      request.user
    );

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `inline; filename="ticket-compra-${purchaseId}.pdf"`
    );
    response.setHeader("Content-Length", pdfBuffer.length);
    response.end(pdfBuffer);
  }
}
