import type { TDocumentDefinitions } from "pdfmake/interfaces";

export interface PdfEngine {
  generatePdf(definition: TDocumentDefinitions): Promise<Buffer>;
}
