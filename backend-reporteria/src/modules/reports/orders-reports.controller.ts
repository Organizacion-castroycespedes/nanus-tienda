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
import { OrdersReportsService } from "./orders-reports.service";

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

@Controller("reports/order-sales")
@UseGuards(JwtAuthGuard, ReportAuthzGuard)
export class OrdersReportsController {
  constructor(
    @Inject(OrdersReportsService)
    private readonly ordersReportsService: OrdersReportsService
  ) {}

  @Get()
  async getOrderSales(
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
      const pdfBuffer = await this.ordersReportsService.getOrderSalesPdf(query, request.user);

      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        'inline; filename="reporte-pedidos.pdf"'
      );
      response.setHeader("Content-Length", pdfBuffer.length);
      response.end(pdfBuffer);
      return;
    }

    response.json(await this.ordersReportsService.getOrderSales(query, request.user));
  }

  @Get(":orderId/ticket")
  @ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  async getOrderSaleTicket(
    @Param("orderId") orderId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const pdfBuffer = await this.ordersReportsService.getOrderSaleTicketPdf(
      orderId,
      request.user
    );

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `inline; filename="ticket-pedido-${orderId}.pdf"`
    );
    response.setHeader("Content-Length", pdfBuffer.length);
    response.end(pdfBuffer);
  }
}
