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
  @ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  async getOrderSales(
    @Query()
    query: {
      tenantId?: string;
      branchId?: string;
      dateFrom?: string;
      dateTo?: string;
      customerDocument?: string;
      format?: string;
    },
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const format = (query.format ?? "json").toLowerCase();
    if (format === "pdf" || format === "xlsx") {
      const document = format === "pdf"
        ? await this.ordersReportsService.getOrderSalesPdf(query, request.user)
        : await this.ordersReportsService.getOrderSalesExcel(query, request.user);
      response.setHeader("Content-Type", format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      response.setHeader("Content-Disposition", `${format === "pdf" ? "inline" : "attachment"}; filename="reporte-pedidos.${format}"`);
      response.setHeader("Content-Length", document.length);
      response.end(document);
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
