import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { buildControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterAdmin } from "../control-center-admin.decorator";
import { ReportsService } from "./reports.service";

const sendFile = (response: Response, content: Buffer, fileName: string, contentType: string) => {
  response.setHeader("Content-Type", contentType);
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.send(content);
};

@Controller("admin/control-center")
@ControlCenterAdmin()
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Get("accounts/:accountId/statement")
  async statement(@Param("accountId") accountId: string, @Query() query: Record<string, unknown>, @Req() request: any, @Res() response: Response) {
    const file = await this.reports.downloadStatement(accountId, query, buildControlCenterRequestContext(request));
    sendFile(response, file.content, file.fileName, "application/pdf");
  }

  @Post("accounts/:accountId/statement/send")
  sendStatement(@Param("accountId") accountId: string, @Body() body: unknown, @Req() request: any) {
    return this.reports.sendStatement(accountId, body, buildControlCenterRequestContext(request));
  }

  @Get("reports/billing-collections")
  async billingCollections(@Query() query: Record<string, unknown>) {
    return (await this.reports.billingCollections(query)).report;
  }

  @Get("reports/billing-collections.xlsx")
  async billingCollectionsXlsx(@Query() query: Record<string, unknown>, @Req() request: any, @Res() response: Response) {
    const file = await this.reports.billingCollectionsWorkbook(query, buildControlCenterRequestContext(request));
    sendFile(response, file.content, file.fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  @Get("reports/renewals")
  renewals(@Query() query: Record<string, unknown>) {
    return this.reports.renewals(query);
  }
}
