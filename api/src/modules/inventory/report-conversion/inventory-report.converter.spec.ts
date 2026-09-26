import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  cleanProductName,
  fillProductTemplate,
  fillStockTemplate,
  gtinIsValid,
  packSize,
  parseInventoryReport,
  parseReportDate,
  planInventoryReport,
  unitVolumeMl,
  type InventoryReportRow,
} from "./inventory-report.converter";

const HEADERS = [
  "Código",
  "Nombre",
  "Variantes",
  "Descripción",
  "Referencia",
  "Tipo",
  "Categoría",
  "Precio Costo",
  "Precio Venta",
  "Existencia",
  "Costo Inventario",
  "Venta Inventario",
];

async function buildReport(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("data");
  sheet.addRow(["Fecha de Exportación", "21 Sep, 2026"]);
  sheet.addRow(HEADERS);
  rows.forEach((row) => sheet.addRow(row));
  sheet.addRow(["Total", "", "", "", "", "", "", "", "", "", 0, 0]);
  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

function row(overrides: Partial<InventoryReportRow>): InventoryReportRow {
  return {
    sourceRow: 3,
    code: "7702004003508",
    name: "Cerveza Aguila lata 330ml",
    variant: "",
    reference: "",
    type: "Inventariable",
    category: "Cerveza",
    cost: 2500,
    price: 3500,
    stock: 10,
    ...overrides,
  };
}

function plan(rows: InventoryReportRow[], existingSkus: string[] = [], existingBarcodes: Array<[string, string]> = []) {
  return planInventoryReport(rows, {
    skuPrefix: "XLS-",
    existingSkus: new Set(existingSkus),
    existingBarcodes: new Map(existingBarcodes),
  });
}

async function template(headers: string[], sheetName: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet(sheetName).addRow(headers);
  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

async function readSheet(buffer: Buffer, sheetName: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet(sheetName)!;
  const headers = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
  const rows: Array<Record<string, unknown>> = [];
  for (let index = 2; index <= sheet.rowCount; index += 1) {
    const values = sheet.getRow(index).values as unknown[];
    rows.push(Object.fromEntries(headers.map((header, column) => [header, values[column + 1] ?? null])));
  }
  return rows;
}

describe("parseInventoryReport", () => {
  it("finds the header row, reads the export date and skips the total row", async () => {
    const report = await parseInventoryReport(
      await buildReport([
        ["7702004003508", "Cerveza Aguila lata 330ml", "", "", "", "Inventariable", "Cerveza", 2500, 3500, "300 (Unidades)", 0, 0],
        ["I-12", "Hielo bolsa", "", "", "", "Inventariable", "", "800", "2000", "-4 (Unidades)", 0, 0],
      ])
    );

    assert.equal(report.exportDate, "2026-09-21");
    assert.equal(report.rows.length, 2);
    assert.deepEqual(
      report.rows.map((item) => [item.sourceRow, item.code, item.cost, item.price, item.stock]),
      [
        [3, "7702004003508", 2500, 3500, 300],
        [4, "I-12", 800, 2000, -4],
      ]
    );
  });

  it("rejects a workbook without the report headers", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("data").addRow(["sku", "nombre"]);
    const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);

    await assert.rejects(parseInventoryReport(buffer), /No se encontró la fila de encabezados/);
  });
});

describe("text helpers", () => {
  it("parses spanish and english month names", () => {
    assert.equal(parseReportDate("21 Sep, 2026"), "2026-09-21");
    assert.equal(parseReportDate("5 ene 2026"), "2026-01-05");
    assert.equal(parseReportDate("sin fecha"), null);
  });

  it("validates GTIN check digits", () => {
    assert.equal(gtinIsValid("7702004003508"), true);
    assert.equal(gtinIsValid("7702004003509"), false);
    assert.equal(gtinIsValid("12345"), false);
  });

  it("fixes typos and appends the purchase variant", () => {
    assert.equal(
      cleanProductName("CEREVEZA  Poker LIGTH", "FORMA DE COMPRA - POR UNIDA"),
      "CERVEZA Poker LIGHT - POR UNIDAD"
    );
    assert.equal(cleanProductName("Aguardiente amarrillo", ""), "Aguardiente amarillo");
  });

  it("reads unit volume and pack size from the name", () => {
    assert.equal(unitVolumeMl("Ron viejo de caldas 1.750"), 1750);
    assert.equal(unitVolumeMl("Vino 1,5 lt"), 1500);
    assert.equal(unitVolumeMl("Aguila lata 330ml"), 330);
    assert.equal(unitVolumeMl("Ron medellin 3 años bot lt"), 1000);
    assert.equal(packSize("Aguila lata 330ml - POR CANASTA"), 30);
    assert.equal(packSize("Poker six pack 6"), 6);
    assert.equal(packSize("Poker lata"), 1);
  });
});

describe("planInventoryReport", () => {
  it("skips deleted codes and non inventory items", () => {
    const result = plan([
      row({ code: "DEL0001-7702004003508" }),
      row({ code: "I-9", type: "Servicio" }),
      row({}),
    ]);

    assert.equal(result.items.length, 1);
    assert.deepEqual(
      result.skipped.map((item) => item.reason),
      [
        "Código DEL: producto eliminado en el sistema de origen.",
        'Tipo "Servicio": no maneja inventario.',
      ]
    );
  });

  it("takes the barcode from the code or the reference and skips duplicates", () => {
    const result = plan(
      [
        row({ sourceRow: 3 }),
        row({ sourceRow: 4, code: "I-20", reference: "7702004003508" }),
        row({ sourceRow: 5, code: "I-21", reference: "7702004003591" }),
      ],
      [],
      [["7702004003591", "OTRO-SKU"]]
    );

    assert.deepEqual(
      result.items.map((item) => [item.sku, item.barcode, item.gtinValid]),
      [
        ["XLS-7702004003508", "7702004003508", true],
        ["XLS-I-20", null, false],
        ["XLS-I-21", null, false],
      ]
    );
    assert.match(result.items[1].notes.join(" "), /se repite con XLS-7702004003508/);
    assert.match(result.items[2].notes.join(" "), /ya pertenece a OTRO-SKU/);
  });

  it("classifies a beer case with pack volume and beer tax data", () => {
    const [item] = plan([
      row({ name: "Cerveza Aguila lata 330ml", variant: "FORMA DE COMPRA - POR CANASTA", price: 90000 }),
    ]).items;

    assert.equal(item.name, "Cerveza Aguila lata 330ml - POR CANASTA");
    assert.equal(item.fiscal, "BEER");
    assert.equal(item.alcohol, 4);
    assert.equal(item.volumeMl, 9900);
    assert.equal(item.danePrice, null);
  });

  it("keeps tequila cocktails out of the snacks rule", () => {
    const [cocktail, snack] = plan([
      row({ code: "I-60", name: "Los cuates tequila margarita limon 269ml", category: "" }),
      row({ code: "I-61", name: "Papa margarita limon 36g", category: "" }),
    ]).items;

    assert.equal(cocktail.subcategory, "Cocteles y RTD");
    assert.equal(cocktail.fiscal, "LIQUOR_APERITIF");
    assert.equal(snack.subcategory, "Pasabocas");
  });

  it("loads zero alcohol beer as GENERAL", () => {
    const [item] = plan([row({ name: "Aguila cero lata 330ml" })]).items;

    assert.equal(item.fiscal, "GENERAL");
    assert.equal(item.alcohol, null);
  });

  it("uses the sale price as provisional DANE price for liquors", () => {
    const [item] = plan([
      row({ code: "I-30", name: "Aguardiente antioqueño 750ml", category: "Licor", price: 60000 }),
    ]).items;

    assert.equal(item.subcategory, "Aguardientes");
    assert.equal(item.fiscal, "DISTILLED_LIQUOR");
    assert.equal(item.alcohol, 29);
    assert.equal(item.volumeMl, 750);
    assert.equal(item.danePrice, 60000);
    assert.match(item.notes.join(" "), /precio_dane provisional/);
  });

  it("falls back to the default volume when the name has none", () => {
    const [item] = plan([row({ code: "I-31", name: "Vino gato negro", category: "Licor" })]).items;

    assert.equal(item.volumeMl, 750);
    assert.match(item.notes.join(" "), /estándar del tipo/);
  });

  it("loads negative stock as zero", () => {
    const [item] = plan([row({ stock: -7 })]).items;

    assert.equal(item.targetStock, 0);
    assert.match(item.notes.join(" "), /Existencia negativa/);
  });

  it("keeps fiscal data out of existing products", () => {
    const [item] = plan([row({})], ["XLS-7702004003508"]).items;

    assert.equal(item.exists, true);
    assert.equal(item.alcohol, null);
    assert.equal(item.volumeMl, null);
    assert.match(item.notes[0], /Ya existe/);
  });
});

describe("template filling", () => {
  it("fills the product template and adds the review sheet", async () => {
    const result = plan(
      [
        row({ sourceRow: 3 }),
        row({ sourceRow: 4, code: "I-40", name: "Gaseosa postobon 400ml", category: "", price: 2500 }),
        row({ sourceRow: 5, code: "DEL9-1" }),
      ],
      ["XLS-I-40"]
    );
    const buffer = await fillProductTemplate(
      await template(
        ["sku", "nombre", "unidad", "precio_venta", "codigo_barras", "estandar_dian", "categoria_fiscal", "iva", "volumen_ml", "categoria", "subcategoria"],
        "Productos"
      ),
      result
    );

    const products = await readSheet(buffer, "Productos");
    assert.deepEqual(products[0], {
      sku: "XLS-7702004003508",
      nombre: "Cerveza Aguila lata 330ml",
      unidad: "UND",
      precio_venta: 3500,
      codigo_barras: "7702004003508",
      estandar_dian: "010",
      categoria_fiscal: "BEER",
      iva: null,
      volumen_ml: 330,
      categoria: "Licores",
      subcategoria: "Cervezas",
    });
    assert.equal(products[1].categoria_fiscal, null);
    assert.equal(products[1].subcategoria, "Gaseosas");

    const review = await readSheet(buffer, "Revision");
    assert.deepEqual(
      review.map((item) => item.accion),
      ["CREA", "ACTUALIZA", "OMITIDO"]
    );
  });

  it("fills the stock template with current and target stock", async () => {
    const result = plan([row({ stock: -2 }), row({ code: "I-50", name: "Hielo bolsa", stock: 12 })]);
    const buffer = await fillStockTemplate(
      await template(["sku", "nombre", "sucursal", "stock_actual", "cantidad"], "Carga_Inicial"),
      result,
      { branchCode: "PRINCIPAL", currentStock: new Map([["XLS-7702004003508", 5]]) }
    );

    assert.deepEqual(await readSheet(buffer, "Carga_Inicial"), [
      { sku: "XLS-7702004003508", nombre: "Cerveza Aguila lata 330ml", sucursal: "PRINCIPAL", stock_actual: 5, cantidad: 0 },
      { sku: "XLS-I-50", nombre: "Hielo bolsa", sucursal: "PRINCIPAL", stock_actual: 0, cantidad: 12 },
    ]);
  });
});
