import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProductImportRawRow } from "./product-import.parser";
import {
  parseImportNumber,
  resolveProductImport,
  type ProductImportCatalogs,
} from "./product-import.resolver";

const IDS = {
  unitUnd: "unit-und",
  iva19: "tax-iva-19",
  iva5: "tax-iva-5",
  exento: "tax-exento",
  icl: "tax-icl",
  adv: "tax-adv",
  beer: "tax-beer",
  general: "fiscal-general",
  liquor: "fiscal-liquor",
  beerCategory: "fiscal-beer",
  licores: "cat-licores",
  aguardiente: "sub-aguardiente",
  branchMain: "branch-main",
  branchSecond: "branch-second",
};

function buildCatalogs(
  overrides: Partial<ProductImportCatalogs> = {}
): ProductImportCatalogs {
  return {
    units: [
      { id: IDS.unitUnd, name: "Unidad", abbreviation: "UND", isActive: true },
      { id: "unit-kg", name: "Kilogramo", abbreviation: "KG", isActive: true },
    ],
    taxes: [
      {
        id: IDS.iva19,
        name: "IVA 19%",
        rate: 0.19,
        isIncluded: true,
        isActive: true,
        taxTypeCode: "VAT",
        calculationMethodCode: "PERCENTAGE",
      },
      {
        id: IDS.iva5,
        name: "IVA 5%",
        rate: 0.05,
        isIncluded: true,
        isActive: true,
        taxTypeCode: "VAT",
        calculationMethodCode: "PERCENTAGE",
      },
      {
        id: IDS.exento,
        name: "Exento",
        rate: 0,
        isIncluded: false,
        isActive: true,
        taxTypeCode: "VAT",
        calculationMethodCode: "PERCENTAGE",
      },
      {
        id: IDS.icl,
        name: "Impuesto al consumo de licores",
        rate: 0,
        isIncluded: true,
        isActive: true,
        taxTypeCode: "LIQUOR_CONSUMPTION",
        calculationMethodCode: "PER_ALCOHOL_DEGREE_VOLUME",
      },
      {
        id: IDS.adv,
        name: "Impuesto ad valórem",
        rate: 0,
        isIncluded: true,
        isActive: true,
        taxTypeCode: "AD_VALOREM",
        calculationMethodCode: "PERCENTAGE",
      },
      {
        id: IDS.beer,
        name: "Impuesto al consumo de cervezas y refajos",
        rate: 0,
        isIncluded: true,
        isActive: true,
        taxTypeCode: "BEER_CONSUMPTION",
        calculationMethodCode: "PERCENTAGE",
      },
    ],
    fiscalCategories: [
      {
        id: IDS.general,
        code: "GENERAL",
        name: "Producto general",
        isAlcoholicBeverage: false,
      },
      {
        id: IDS.liquor,
        code: "DISTILLED_LIQUOR",
        name: "Licor destilado",
        isAlcoholicBeverage: true,
      },
      {
        id: IDS.beerCategory,
        code: "BEER",
        name: "Cerveza",
        isAlcoholicBeverage: true,
      },
    ],
    fiscalCategoryTaxLinks: [
      { taxId: IDS.icl, taxProductCategoryId: IDS.liquor },
      { taxId: IDS.adv, taxProductCategoryId: IDS.liquor },
      { taxId: IDS.beer, taxProductCategoryId: IDS.beerCategory },
    ],
    categories: [{ id: IDS.licores, name: "Licores", slug: "licores" }],
    subcategories: [
      {
        id: IDS.aguardiente,
        categoryId: IDS.licores,
        name: "Aguardiente",
        slug: "aguardiente",
      },
    ],
    branches: [
      { id: IDS.branchMain, code: "PRINCIPAL", name: "Principal", isActive: true },
    ],
    accessibleBranchIds: null,
    existingProducts: [],
    existingBarcodes: [],
    ...overrides,
  };
}

function row(
  values: ProductImportRawRow["values"],
  rowNumber = 2
): ProductImportRawRow {
  return {
    rowNumber,
    values: {
      sku: "SKU-1",
      nombre: "Producto 1",
      unidad: "UND",
      precio_venta: "1000",
      costo: "600",
      ...values,
    },
  };
}

function resolveOne(
  values: ProductImportRawRow["values"],
  catalogs = buildCatalogs()
) {
  const report = resolveProductImport([row(values)], catalogs, {
    today: "2026-09-25",
  });
  return { report, plan: report.rows[0] };
}

describe("parseImportNumber", () => {
  it("parses plain, thousands and decimal formats", () => {
    assert.equal(parseImportNumber("1500"), 1500);
    assert.equal(parseImportNumber("162.800"), 162800);
    assert.equal(parseImportNumber("1,250"), 1250);
    assert.equal(parseImportNumber("1.250,50"), 1250.5);
    assert.equal(parseImportNumber("0.19"), 0.19);
    assert.equal(parseImportNumber("4,5"), 4.5);
    assert.equal(parseImportNumber("$ 85.000"), 85000);
    assert.equal(parseImportNumber("19%"), 19);
    assert.ok(Number.isNaN(parseImportNumber("abc")));
  });
});

describe("resolveProductImport taxes", () => {
  it("assigns tenant IVA 19 when iva column is 19", () => {
    const { plan, report } = resolveOne({ iva: "19" });

    assert.deepEqual(plan.errors, []);
    assert.equal(report.canCommit, true);
    assert.deepEqual(plan.taxes, [
      { taxId: IDS.iva19, name: "IVA 19%", calculationOrder: 100, isIncluded: true },
    ]);
    assert.equal(plan.taxProfile, null);
    assert.equal(plan.fiscalCategory?.code, "GENERAL");
  });

  it("accepts 19% and 0.19 and EXENTO", () => {
    assert.equal(resolveOne({ iva: "19%" }).plan.taxes?.[0].taxId, IDS.iva19);
    assert.equal(resolveOne({ iva: "0.19" }).plan.taxes?.[0].taxId, IDS.iva19);
    assert.equal(resolveOne({ iva: "exento" }).plan.taxes?.[0].taxId, IDS.exento);
  });

  it("matches taxes stored with rate 19 instead of 0.19", () => {
    const catalogs = buildCatalogs();
    catalogs.taxes = catalogs.taxes.map((tax) =>
      tax.id === IDS.iva19 ? { ...tax, rate: 19 } : tax
    );

    const { plan } = resolveOne({ iva: "19" }, catalogs);

    assert.equal(plan.taxes?.[0].taxId, IDS.iva19);
  });

  it("fails when tenant has no IVA with that rate", () => {
    const { plan, report } = resolveOne({ iva: "8" });

    assert.equal(report.canCommit, false);
    assert.match(plan.errors.join(" "), /No existe un IVA de 8%/);
  });

  it("requires iva for GENERAL fiscal category", () => {
    const { plan } = resolveOne({});

    assert.match(plan.errors.join(" "), /iva es obligatorio/);
  });

  it("takes IVA 5 and liquor taxes from tax_rates for distilled liquor", () => {
    const { plan } = resolveOne({
      categoria_fiscal: "Licor destilado",
      grado_alcohol: "29",
      volumen_ml: "1000",
      precio_dane: "85000",
    });

    assert.deepEqual(plan.errors, []);
    assert.deepEqual(
      plan.taxes?.map((tax) => [tax.taxId, tax.calculationOrder]),
      [
        [IDS.icl, 10],
        [IDS.adv, 20],
        [IDS.iva5, 100],
      ]
    );
    assert.deepEqual(plan.taxProfile, {
      taxProductCategoryId: IDS.liquor,
      alcoholDegree: 29,
      netVolumeMl: 1000,
      daneCertifiedRetailPrice: 85000,
      danePriceEffectiveFrom: "2026-09-25",
      danePriceEffectiveTo: null,
    });
    assert.match(plan.warnings.join(" "), /IVA 5% tomado de la categoría fiscal/);
  });

  it("keeps liquor special taxes when row overrides IVA", () => {
    const { plan } = resolveOne({
      categoria_fiscal: "DISTILLED_LIQUOR",
      iva: "19",
      grado_alcohol: "40",
      volumen_ml: "750",
      precio_dane: "150000",
    });

    assert.deepEqual(
      plan.taxes?.map((tax) => tax.taxId),
      [IDS.icl, IDS.adv, IDS.iva19]
    );
  });

  it("uses IVA 19 and beer tax for beer", () => {
    const { plan } = resolveOne({
      categoria_fiscal: "cerveza",
      grado_alcohol: "4.5",
      volumen_ml: "330",
    });

    assert.deepEqual(plan.errors, []);
    assert.deepEqual(
      plan.taxes?.map((tax) => tax.taxId),
      [IDS.beer, IDS.iva19]
    );
  });

  it("requires alcohol degree, volume and DANE price for liquor", () => {
    const { plan } = resolveOne({ categoria_fiscal: "DISTILLED_LIQUOR" });

    const errors = plan.errors.join(" ");
    assert.match(errors, /grado_alcohol es obligatorio/);
    assert.match(errors, /volumen_ml es obligatorio/);
    assert.match(errors, /precio_dane es obligatorio/);
  });

  it("rejects unknown fiscal category", () => {
    const { plan } = resolveOne({ categoria_fiscal: "JUGOS", iva: "19" });

    assert.match(plan.errors.join(" "), /categoria_fiscal: "JUGOS" no existe/);
  });
});

describe("resolveProductImport catalog", () => {
  it("fails when unit does not exist", () => {
    const { plan } = resolveOne({ unidad: "CAJA", iva: "19" });

    assert.match(plan.errors.join(" "), /La unidad "CAJA" no existe/);
  });

  it("matches existing category and subcategory by name", () => {
    const { plan, report } = resolveOne({
      iva: "19",
      categoria: "licores",
      subcategoria: "AGUARDIENTE",
    });

    assert.equal(plan.category?.id, IDS.licores);
    assert.equal(plan.subcategory?.id, IDS.aguardiente);
    assert.deepEqual(report.newCategories, []);
  });

  it("plans new categories and subcategories once", () => {
    const report = resolveProductImport(
      [
        row({ iva: "19", categoria: "Aseo", subcategoria: "Jabones" }, 2),
        row(
          { sku: "SKU-2", iva: "19", categoria: "ASEO", subcategoria: "jabones" },
          3
        ),
      ],
      buildCatalogs(),
      { today: "2026-09-25" }
    );

    assert.deepEqual(report.newCategories, [{ name: "Aseo", slug: "aseo" }]);
    assert.equal(report.newSubcategories.length, 1);
    assert.equal(report.rows[0].category?.isNew, true);
    assert.equal(report.canCommit, true);
  });

  it("requires category when subcategory is given", () => {
    const { plan } = resolveOne({ iva: "19", subcategoria: "Jabones" });

    assert.match(plan.errors.join(" "), /subcategoria requiere categoria/);
  });

  it("marks duplicated SKU in file as error", () => {
    const report = resolveProductImport(
      [row({ iva: "19" }, 2), row({ sku: "sku-1", iva: "19" }, 3)],
      buildCatalogs(),
      { today: "2026-09-25" }
    );

    assert.deepEqual(report.rows[0].errors, []);
    assert.match(report.rows[1].errors.join(" "), /repetido en el archivo \(fila 2\)/);
  });

  it("defaults standard identification to 999 with SKU on create", () => {
    const { plan } = resolveOne({ iva: "19" });

    assert.deepEqual(plan.product.standardIdentification, {
      scheme: "999",
      code: "SKU-1",
    });
  });

  it("rejects barcode owned by another product", () => {
    const { plan } = resolveOne(
      { iva: "19", codigo_barras: "7700000000001" },
      buildCatalogs({
        existingBarcodes: [{ barcode: "7700000000001", productId: "other" }],
      })
    );

    assert.match(plan.errors.join(" "), /ya pertenece a otro producto/);
  });
});

describe("resolveProductImport update", () => {
  const existingProduct = {
    id: "prod-1",
    sku: "SKU-1",
    price: 1000,
    saleType: "UNIT" as const,
    measurementUnit: "UND" as const,
    requiresLot: false,
    requiresExpiration: false,
    isPerishable: false,
    categoryId: null,
    subcategoryId: null,
  };

  it("updates existing SKU without touching taxes when fiscal columns are empty", () => {
    const { plan } = resolveOne(
      { sku: "sku-1", precio_venta: "1200", unidad: "" },
      buildCatalogs({ existingProducts: [existingProduct] })
    );

    assert.deepEqual(plan.errors, []);
    assert.equal(plan.action, "UPDATE");
    assert.equal(plan.productId, "prod-1");
    assert.equal(plan.taxes, null);
    assert.equal(plan.taxProfile, undefined);
    assert.equal(plan.priceChanged, true);
    assert.equal(plan.product.standardIdentification, undefined);
    assert.equal(plan.product.requiresLot, undefined);
  });

  it("replaces taxes on update when iva is given", () => {
    const { plan } = resolveOne(
      { iva: "5" },
      buildCatalogs({ existingProducts: [existingProduct] })
    );

    assert.deepEqual(plan.taxes?.map((tax) => tax.taxId), [IDS.iva5]);
    assert.equal(plan.priceChanged, false);
  });

  it("warns that stock is added on update", () => {
    const { plan } = resolveOne(
      { cantidad: "5" },
      buildCatalogs({ existingProducts: [existingProduct] })
    );

    assert.deepEqual(plan.errors, []);
    assert.equal(plan.stock?.quantity, 5);
    assert.match(plan.warnings.join(" "), /se sumará al stock actual/);
  });
});

describe("resolveProductImport stock", () => {
  it("requires lot code when product requires lot", () => {
    const { plan } = resolveOne({
      iva: "19",
      requiere_lote: "SI",
      cantidad: "4",
    });

    assert.match(plan.errors.join(" "), /lote_codigo es obligatorio/);
  });

  it("marks lot automatically when expiration is required", () => {
    const { plan } = resolveOne({
      iva: "19",
      requiere_vencimiento: "SI",
      cantidad: "4",
      lote_codigo: "lot-1",
      fecha_vencimiento: "2027-06-30",
      costo_unitario: "550",
    });

    assert.deepEqual(plan.errors, []);
    assert.equal(plan.product.requiresLot, true);
    assert.deepEqual(plan.stock, {
      branchId: IDS.branchMain,
      branchCode: "PRINCIPAL",
      quantity: 4,
      unitCost: 550,
      lotCode: "LOT-1",
      expirationDate: "2027-06-30",
    });
  });

  it("rejects lot data for products without lot control", () => {
    const { plan } = resolveOne({
      iva: "19",
      cantidad: "4",
      lote_codigo: "LOT-1",
    });

    assert.match(plan.errors.join(" "), /no maneja lote/);
  });

  it("rejects invalid expiration dates", () => {
    const { plan } = resolveOne({
      iva: "19",
      requiere_lote: "SI",
      cantidad: "4",
      lote_codigo: "LOT-1",
      fecha_vencimiento: "2027-02-30",
    });

    assert.match(plan.errors.join(" "), /formato YYYY-MM-DD/);
  });

  it("requires branch when tenant has several branches", () => {
    const { plan } = resolveOne(
      { iva: "19", cantidad: "4" },
      buildCatalogs({
        branches: [
          { id: IDS.branchMain, code: "PRINCIPAL", name: "Principal", isActive: true },
          { id: IDS.branchSecond, code: "NORTE", name: "Norte", isActive: true },
        ],
      })
    );

    assert.match(plan.errors.join(" "), /sucursal es obligatoria/);
  });

  it("rejects branches the user cannot access", () => {
    const { plan } = resolveOne(
      { iva: "19", cantidad: "4", sucursal: "principal" },
      buildCatalogs({ accessibleBranchIds: new Set<string>() })
    );

    assert.match(plan.errors.join(" "), /No tiene acceso a la sucursal/);
  });
});
