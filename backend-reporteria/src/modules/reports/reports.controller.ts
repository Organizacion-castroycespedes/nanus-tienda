import {
  Controller,
  Get,
  Inject,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReportAuthzGuard } from "../auth/report-authz.guard";
import type { ReportUser } from "../auth/report-auth.types";
import { ReportsService } from "./reports.service";

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

@Controller("reports")
@UseGuards(JwtAuthGuard, ReportAuthzGuard)
export class ReportsController {
  constructor(
    @Inject(ReportsService)
    private readonly reportsService: ReportsService
  ) {}

  @Get("health")
  getHealth() {
    return this.reportsService.getHealth();
  }

  @Get("demo")
  getDemo(@Req() request: AuthenticatedRequest) {
    return this.reportsService.getDemo(request.user);
  }

  @Get("demo-pdf")
  async getDemoPdf(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const pdfBuffer = await this.reportsService.getDemoPdf(request.user);

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      'inline; filename="report-demo.pdf"'
    );
    response.setHeader("Content-Length", pdfBuffer.length);
    response.end(pdfBuffer);
  }
}
