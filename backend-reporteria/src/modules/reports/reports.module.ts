import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { PdfModule } from "../pdf/pdf.module";
import { CashReportsController } from "./cash-reports.controller";
import { CashReportsService } from "./cash-reports.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { SalesReportsController } from "./sales-reports.controller";
import { SalesReportsService } from "./sales-reports.service";
import { CashReportAdapter } from "./sql-adapters/cash-report.adapter";
import { SalesReportAdapter } from "./sql-adapters/sales-report.adapter";

@Module({
  imports: [AuthModule, DatabaseModule, PdfModule],
  controllers: [ReportsController, SalesReportsController, CashReportsController],
  providers: [
    ReportsService,
    SalesReportsService,
    CashReportsService,
    SalesReportAdapter,
    CashReportAdapter,
  ],
})
export class ReportsModule {}
