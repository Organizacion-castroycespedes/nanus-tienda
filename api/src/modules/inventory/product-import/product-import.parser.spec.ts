import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import {
  parseProductImportWorkbook,
  ProductImportParseError,
} from "./product-import.parser";

async function buildWorkbook(
  rows: unknown[][],
  sheetName = "Productos"
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

describe("parseProductImportWorkbook", () => {
  it("maps headers ignoring case, accents and required marks", async () => {
    const buffer = await buildWorkbook([
      ["SKU*", "Nombre", "Unidad", "Precio Venta", "Costo", "Categoría", "Otra"],
      ["abc-1", "Producto 1", "UND", 1500, 1000, "Bebidas", "x"],
    ]);

    const result = await parseProductImportWorkbook(buffer);

    assert.equal(result.rows.length, 1);
    assert.deepEqual(result.rows[0], {
      rowNumber: 2,
      values: {
        sku: "abc-1",
        nombre: "Producto 1",
        unidad: "UND",
        precio_venta: "1500",
        costo: "1000",
        categoria: "Bebidas",
      },
    });
    assert.deepEqual(result.ignoredHeaders, ["Otra"]);
  });

  it("skips empty rows and keeps the original row number", async () => {
    const buffer = await buildWorkbook([
      ["sku", "nombre", "unidad", "precio_venta", "costo"],
      ["A", "Uno", "UND", 1, 1],
      [],
      ["B", "Dos", "UND", 2, 2],
    ]);

    const result = await parseProductImportWorkbook(buffer);

    assert.deepEqual(
      result.rows.map((row) => [row.rowNumber, row.values.sku]),
      [
        [2, "A"],
        [4, "B"],
      ]
    );
  });

  it("formats date cells as YYYY-MM-DD", async () => {
    const buffer = await buildWorkbook([
      ["sku", "nombre", "unidad", "precio_venta", "costo", "fecha_vencimiento"],
      ["A", "Uno", "UND", 1, 1, new Date(Date.UTC(2027, 5, 30))],
    ]);

    const result = await parseProductImportWorkbook(buffer);

    assert.equal(result.rows[0].values.fecha_vencimiento, "2027-06-30");
  });

  it("uses the first sheet when Productos does not exist", async () => {
    const buffer = await buildWorkbook(
      [
        ["sku", "nombre", "unidad", "precio_venta", "costo"],
        ["A", "Uno", "UND", 1, 1],
      ],
      "Hoja1"
    );

    const result = await parseProductImportWorkbook(buffer);

    assert.equal(result.rows.length, 1);
  });

  it("rejects missing required headers", async () => {
    const buffer = await buildWorkbook([
      ["sku", "nombre"],
      ["A", "Uno"],
    ]);

    await assert.rejects(
      parseProductImportWorkbook(buffer),
      (error: unknown) =>
        error instanceof ProductImportParseError &&
        error.message.includes("unidad, precio_venta, costo")
    );
  });

  it("rejects files over the row limit", async () => {
    const buffer = await buildWorkbook([
      ["sku", "nombre", "unidad", "precio_venta", "costo"],
      ["A", "Uno", "UND", 1, 1],
      ["B", "Dos", "UND", 1, 1],
    ]);

    await assert.rejects(
      parseProductImportWorkbook(buffer, { maxRows: 1 }),
      ProductImportParseError
    );
  });

  it("rejects invalid files", async () => {
    await assert.rejects(
      parseProductImportWorkbook(Buffer.from("no es excel")),
      ProductImportParseError
    );
  });
});
