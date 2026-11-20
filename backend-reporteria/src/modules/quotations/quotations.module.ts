import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { PdfModule } from "../pdf/pdf.module";
import { QuotationPdfController } from "./quotation-pdf.controller";
import { QuotationPdfService } from "./quotation-pdf.service";

@Module({
  imports: [AuthModule, DatabaseModule, PdfModule],
  controllers: [QuotationPdfController],
  providers: [QuotationPdfService],
})
export class QuotationsModule {}
