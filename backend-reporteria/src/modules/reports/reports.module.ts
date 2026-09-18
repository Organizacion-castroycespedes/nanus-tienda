import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { PdfModule } from "../pdf/pdf.module";
import { CashReportsController } from "./cash-reports.controller";
import { CashReportsService } from "./cash-reports.service";
import { CustomersReportsController } from "./customers-reports.controller";
import { CustomersReportsService } from "./customers-reports.service";
import { CurrentShiftReportsController } from "./current-shift-reports.controller";
import { CurrentShiftReportsService } from "./current-shift-reports.service";
import { DeliveriesReportsController } from "./deliveries-reports.controller";
import { DeliveriesReportsService } from "./deliveries-reports.service";
import { OrdersReportsController } from "./orders-reports.controller";
import { OrdersReportsService } from "./orders-reports.service";
import { PurchasesReportsController } from "./purchases-reports.controller";
import { PurchasesReportsService } from "./purchases-reports.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { SalesReportsController } from "./sales-reports.controller";
import { SalesReportsService } from "./sales-reports.service";
import { CashReportAdapter } from "./sql-adapters/cash-report.adapter";
import { CustomersReportAdapter } from "./sql-adapters/customers-report.adapter";
import { DeliveriesReportAdapter } from "./sql-adapters/deliveries-report.adapter";
import { OrdersReportAdapter } from "./sql-adapters/orders-report.adapter";
import { PurchasesReportAdapter } from "./sql-adapters/purchases-report.adapter";
import { ProductInventoryReportsController } from "./product-inventory-reports.controller";
import { ProductInventoryReportsService } from "./product-inventory-reports.service";
import { SalesReportAdapter } from "./sql-adapters/sales-report.adapter";

@Module({
  imports: [AuthModule, DatabaseModule, PdfModule],
  controllers: [
    ReportsController,
    SalesReportsController,
    CashReportsController,
    PurchasesReportsController,
    OrdersReportsController,
    DeliveriesReportsController,
    CustomersReportsController,
    CurrentShiftReportsController,
    ProductInventoryReportsController,
  ],
  providers: [
    ReportsService,
    SalesReportsService,
    CashReportsService,
    PurchasesReportsService,
    OrdersReportsService,
    DeliveriesReportsService,
    CustomersReportsService,
    CurrentShiftReportsService,
    ProductInventoryReportsService,
    SalesReportAdapter,
    CashReportAdapter,
    PurchasesReportAdapter,
    OrdersReportAdapter,
    DeliveriesReportAdapter,
    CustomersReportAdapter,
  ],
})
export class ReportsModule {}
