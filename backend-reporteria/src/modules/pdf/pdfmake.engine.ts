import { Injectable } from "@nestjs/common";
import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import * as path from "node:path";
import type { PdfEngine } from "./pdf-engine.interface";

@Injectable()
export class PdfmakeEngine implements PdfEngine {
  private readonly printer: PdfPrinter;

  constructor() {
    const pdfmakePackageJson = require.resolve("pdfmake/package.json");
    const pdfmakeRoot = path.dirname(pdfmakePackageJson);
    const examplesFontsPath = path.join(pdfmakeRoot, "examples", "fonts");
    const robotoRegular = path.join(examplesFontsPath, "Roboto-Regular.ttf");
    const robotoMedium = path.join(examplesFontsPath, "Roboto-Medium.ttf");
    const robotoItalic = path.join(examplesFontsPath, "Roboto-Italic.ttf");
    const robotoMediumItalic = path.join(
      examplesFontsPath,
      "Roboto-MediumItalic.ttf"
    );
    const hasBundledRobotoFonts =
      require("node:fs").existsSync(robotoRegular) &&
      require("node:fs").existsSync(robotoMedium) &&
      require("node:fs").existsSync(robotoItalic) &&
      require("node:fs").existsSync(robotoMediumItalic);

    const fonts = {
      Roboto: {
        // Fall back to standard PDF fonts when the npm package does not ship
        // example TTF files in this environment.
        normal: hasBundledRobotoFonts ? robotoRegular : "Helvetica",
        bold: hasBundledRobotoFonts ? robotoMedium : "Helvetica-Bold",
        italics: hasBundledRobotoFonts ? robotoItalic : "Helvetica-Oblique",
        bolditalics: hasBundledRobotoFonts
          ? robotoMediumItalic
          : "Helvetica-BoldOblique",
      },
    };

    this.printer = new PdfPrinter(fonts);
  }

  async generatePdf(definition: TDocumentDefinitions): Promise<Buffer> {
    const document = this.printer.createPdfKitDocument(definition);

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      document.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);
      document.end();
    });
  }
}
