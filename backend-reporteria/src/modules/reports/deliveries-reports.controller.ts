import { Controller, Get, Inject, Param, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReportAuthzGuard } from "../auth/report-authz.guard";
import { ReportRoles } from "../auth/report-roles.decorator";
import type { ReportUser } from "../auth/report-auth.types";
import { DeliveriesReportsService } from "./deliveries-reports.service";

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

@Controller("reports/deliveries")
@UseGuards(JwtAuthGuard, ReportAuthzGuard)
export class DeliveriesReportsController {
  constructor(
    @Inject(DeliveriesReportsService)
    private readonly deliveriesReportsService: DeliveriesReportsService
  ) {}

  @Get(":deliveryId/ticket")
  @ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  async getDeliveryTicket(
    @Param("deliveryId") deliveryId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const pdfBuffer = await this.deliveriesReportsService.getDeliveryTicketPdf(
      deliveryId,
      request.user
    );

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `inline; filename="ticket-domicilio-${deliveryId}.pdf"`
    );
    response.setHeader("Content-Length", pdfBuffer.length);
    response.end(pdfBuffer);
  }
}
