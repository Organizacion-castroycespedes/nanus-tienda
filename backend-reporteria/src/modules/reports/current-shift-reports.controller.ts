import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReportAuthzGuard } from "../auth/report-authz.guard";
import { ReportRoles } from "../auth/report-roles.decorator";
import type { ReportUser } from "../auth/report-auth.types";
import { CurrentShiftReportsService } from "./current-shift-reports.service";
import type {
  CurrentShiftQuery,
  CurrentShiftResponse,
} from "./types/current-shift-report.types";

type AuthenticatedRequest = Request & {
  user?: ReportUser;
};

@Controller("reports")
@UseGuards(JwtAuthGuard, ReportAuthzGuard)
export class CurrentShiftReportsController {
  constructor(
    @Inject(CurrentShiftReportsService)
    private readonly currentShiftReportsService: CurrentShiftReportsService
  ) {}

  @Get("current-shift")
  @ReportRoles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  getCurrentShift(
    @Query() query: CurrentShiftQuery,
    @Req() request: AuthenticatedRequest
  ): Promise<CurrentShiftResponse> {
    return this.currentShiftReportsService.getCurrentShift(query, request.user);
  }
}
