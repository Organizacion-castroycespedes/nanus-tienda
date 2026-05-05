import { Module } from "@nestjs/common";
import { PdfmakeEngine } from "./pdfmake.engine";

@Module({
  providers: [PdfmakeEngine],
  exports: [PdfmakeEngine],
})
export class PdfModule {}
