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
import { CashReportsService } from "./cash-reports.service";

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

@Controller("reports")
@UseGuards(JwtAuthGuard, ReportAuthzGuard)
export class CashReportsController {
  constructor(
    @Inject(CashReportsService)
    private readonly cashReportsService: CashReportsService
  ) {}

  @Get("cash-closings")
  async getCashClosings(
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
      const pdfBuffer = await this.cashReportsService.getCashClosingsPdf(query, request.user);

      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        'inline; filename="reporte-cierres-caja.pdf"'
      );
      response.setHeader("Content-Length", pdfBuffer.length);
      response.end(pdfBuffer);
      return;
    }

    response.json(await this.cashReportsService.getCashClosings(query, request.user));
  }

  @Get("cash-closings/:cashSessionId/ticket")
  async getCashClosingTicket(
    @Param("cashSessionId") cashSessionId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const pdfBuffer = await this.cashReportsService.getCashClosingTicketPdf(
      cashSessionId,
      request.user
    );

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `inline; filename="ticket-cierre-caja-${cashSessionId}.pdf"`
    );
    response.setHeader("Content-Length", pdfBuffer.length);
    response.end(pdfBuffer);
  }

  @Get("cash-audits")
  async getCashAudits(
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
      const pdfBuffer = await this.cashReportsService.getCashAuditsPdf(query, request.user);

      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        'inline; filename="reporte-arqueos-caja.pdf"'
      );
      response.setHeader("Content-Length", pdfBuffer.length);
      response.end(pdfBuffer);
      return;
    }

    response.json(await this.cashReportsService.getCashAudits(query, request.user));
  }

  @Get("cash-audits/:cashCountId/ticket")
  async getCashAuditTicket(
    @Param("cashCountId") cashCountId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const pdfBuffer = await this.cashReportsService.getCashAuditTicketPdf(
      cashCountId,
      request.user
    );

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `inline; filename="ticket-arqueo-caja-${cashCountId}.pdf"`
    );
    response.setHeader("Content-Length", pdfBuffer.length);
    response.end(pdfBuffer);
  }
}
