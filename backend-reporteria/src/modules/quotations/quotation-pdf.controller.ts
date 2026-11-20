import { Controller, Get, Inject, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { ReportUser } from "../auth/report-auth.types";
import { ReportAuthzGuard } from "../auth/report-authz.guard";
import { ReportRoles } from "../auth/report-roles.decorator";
import { QuotationPdfService } from "./quotation-pdf.service";

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

@Controller("reports/quotations")
@UseGuards(JwtAuthGuard, ReportAuthzGuard)
export class QuotationPdfController {
  constructor(@Inject(QuotationPdfService) private readonly quotationPdfService: QuotationPdfService) {}

  @Get(":quotationId/pdf")
  @ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  async getPdf(
    @Param("quotationId") quotationId: string,
    @Query("disposition") disposition: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const { buffer, code } = await this.quotationPdfService.getPdf(quotationId, request.user);
    const safeCode = code.replace(/[^A-Za-z0-9-]/g, "");
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `${disposition === "attachment" ? "attachment" : "inline"}; filename="cotizacion-${safeCode}.pdf"`
    );
    response.setHeader("Content-Length", buffer.length);
    response.end(buffer);
  }
}
