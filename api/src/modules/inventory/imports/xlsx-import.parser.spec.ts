import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import {
  isValidIsoDate,
  parseImportNumber,
  parseXlsxSheet,
  XlsxImportParseError,
} from "./xlsx-import.parser";

type Key = "sku" | "cantidad" | "sucursal";

const OPTIONS = {
  sheetNames: ["Carga_Inicial", "Stock"],
  columns: ["sku", "cantidad", "sucursal"] as const,
  required: ["sku", "cantidad"] as const,
  aliases: { producto_id: "sku", sucursal_id: "sucursal" } as Record<string, Key>,
  maxRows: 10,
};

async function buildWorkbook(
  sheets: Array<{ name: string; rows: unknown[][] }>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    sheet.rows.forEach((row) => worksheet.addRow(row));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

describe("parseXlsxSheet", () => {
  it("maps aliases to canonical keys", async () => {
    const buffer = await buildWorkbook([
      {
        name: "Carga_Inicial",
        rows: [
          ["Producto ID", "Sucursal_ID", "Cantidad"],
          ["A-1", "PRINCIPAL", 4],
        ],
      },
    ]);

    const result = await parseXlsxSheet<Key>(buffer, OPTIONS);

    assert.equal(result.sheetName, "Carga_Inicial");
    assert.deepEqual(result.rows[0].values, {
      sku: "A-1",
      sucursal: "PRINCIPAL",
      cantidad: "4",
    });
  });

  it("prefers the named sheet over the first sheet", async () => {
    const buffer = await buildWorkbook([
      { name: "Instrucciones", rows: [["Campo", "Descripcion"]] },
      { name: "stock", rows: [["sku", "cantidad"], ["A", 1]] },
    ]);

    const result = await parseXlsxSheet<Key>(buffer, OPTIONS);

    assert.equal(result.sheetName, "stock");
    assert.equal(result.rows.length, 1);
  });

  it("falls back to the first sheet", async () => {
    const buffer = await buildWorkbook([
      { name: "Hoja1", rows: [["sku", "cantidad"], ["A", 1]] },
    ]);

    const result = await parseXlsxSheet<Key>(buffer, OPTIONS);

    assert.equal(result.sheetName, "Hoja1");
  });

  it("rejects duplicated headers after alias resolution", async () => {
    const buffer = await buildWorkbook([
      { name: "Stock", rows: [["sku", "producto_id", "cantidad"], ["A", "B", 1]] },
    ]);

    await assert.rejects(
      parseXlsxSheet<Key>(buffer, OPTIONS),
      (error: unknown) =>
        error instanceof XlsxImportParseError && error.message.includes("repetida")
    );
  });

  it("enforces the row limit", async () => {
    const rows: unknown[][] = [["sku", "cantidad"]];
    for (let index = 0; index < 11; index += 1) {
      rows.push([`A${index}`, 1]);
    }
    const buffer = await buildWorkbook([{ name: "Stock", rows }]);

    await assert.rejects(
      parseXlsxSheet<Key>(buffer, OPTIONS),
      (error: unknown) =>
        error instanceof XlsxImportParseError && error.message.includes("10 filas")
    );
  });

  it("requires at least one column of each requiredAnyOf group", async () => {
    const buffer = await buildWorkbook([
      { name: "Stock", rows: [["sucursal", "cantidad"], ["PRINCIPAL", 1]] },
    ]);

    await assert.rejects(
      parseXlsxSheet<Key>(buffer, {
        ...OPTIONS,
        required: ["cantidad"],
        requiredAnyOf: [["sku"]],
      }),
      (error: unknown) =>
        error instanceof XlsxImportParseError &&
        error.message.includes("al menos una de estas columnas: sku")
    );
  });

  it("rejects sheets without data rows", async () => {
    const buffer = await buildWorkbook([{ name: "Stock", rows: [["sku", "cantidad"]] }]);

    await assert.rejects(parseXlsxSheet<Key>(buffer, OPTIONS), XlsxImportParseError);
  });
});

describe("import value helpers", () => {
  it("parses numbers in local and plain formats", () => {
    assert.equal(parseImportNumber("162.800"), 162800);
    assert.equal(parseImportNumber("1.250,50"), 1250.5);
    assert.equal(parseImportNumber("4,5"), 4.5);
    assert.equal(parseImportNumber(""), null);
    assert.ok(Number.isNaN(parseImportNumber("abc")));
  });

  it("validates ISO dates", () => {
    assert.equal(isValidIsoDate("2026-12-31"), true);
    assert.equal(isValidIsoDate("2026-02-30"), false);
    assert.equal(isValidIsoDate("31/12/2026"), false);
  });
});
