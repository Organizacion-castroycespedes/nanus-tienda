import {
  Controller,
  Get,
  Inject,
  Req,
  Res,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReportAuthzGuard } from "../auth/report-authz.guard";
import type { ReportUser } from "../auth/report-auth.types";
import { ReportsService } from "./reports.service";
import { OperationalControlService } from "./operational-control.service";
import type { OperationalControlQuery } from "./operational-control.types";
import { ReportRoles } from "../auth/report-roles.decorator";

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

@Controller("reports")
export class ReportsController {
  constructor(
    @Inject(ReportsService)
    private readonly reportsService: ReportsService
    , @Inject(OperationalControlService)
    private readonly operationalControlService: OperationalControlService
  ) {}

  @Get("health")
  getHealth() {
    return this.reportsService.getHealth();
  }

  @UseGuards(JwtAuthGuard, ReportAuthzGuard)
  @Get("operational-control")
  @ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  getOperationalControl(@Query() query: OperationalControlQuery, @Req() request: AuthenticatedRequest) {
    return this.operationalControlService.getSnapshot(query, request.user);
  }

  @UseGuards(JwtAuthGuard, ReportAuthzGuard)
  @Get("demo")
  getDemo(@Req() request: AuthenticatedRequest) {
    return this.reportsService.getDemo(request.user);
  }

  @UseGuards(JwtAuthGuard, ReportAuthzGuard)
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
