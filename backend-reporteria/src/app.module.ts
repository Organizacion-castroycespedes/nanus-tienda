import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module";
import { DatabaseModule } from "./modules/database/database.module";
import { PdfModule } from "./modules/pdf/pdf.module";
import { QuotationsModule } from "./modules/quotations/quotations.module";
import { ReportsModule } from "./modules/reports/reports.module";

@Module({
  imports: [AuthModule, DatabaseModule, PdfModule, ReportsModule, QuotationsModule],
})
export class AppModule {}
