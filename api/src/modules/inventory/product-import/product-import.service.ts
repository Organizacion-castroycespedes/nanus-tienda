import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
} from "@nestjs/common";
import ExcelJS from "exceljs";
import {
  AccessControlService,
  type AccessActor,
} from "../../../common/services/access-control.service";
import { ProductCategoryRepository } from "../repositories/product-category.repository";
import { ProductSubcategoryRepository } from "../repositories/product-subcategory.repository";
import { TaxRepository } from "../repositories/tax.repository";
import { UnitRepository } from "../repositories/unit.repository";
import { ProductBarcodeService } from "../services/product-barcode.service";
import { ProductCategoryService } from "../services/product-category.service";
import { ProductService } from "../services/product.service";
import { ProductSubcategoryService } from "../services/product-subcategory.service";
import { StockAdjustmentService } from "../services/stock-adjustment.service";
import { todayInBusinessTimeZone } from "../imports/business-date";
import {
  PRODUCT_IMPORT_COLUMNS,
  PRODUCT_IMPORT_SHEET_NAME,
} from "./product-import.columns";
import {
  parseProductImportWorkbook,
  ProductImportParseError,
  type ProductImportRawRow,
} from "./product-import.parser";
import { ProductImportRepository } from "./product-import.repository";
import {
  resolveProductImport,
  type ProductImportCatalogs,
  type ProductImportReport,
  type ProductImportRowPlan,
} from "./product-import.resolver";

export const PRODUCT_IMPORT_REASON = "Carga inicial xlsx";
const TEMPLATE_VALIDATION_ROWS = 500;
export type ProductImportValidation = {
  report: ProductImportReport;
  ignoredHeaders: string[];
};

export type ProductImportRowResult = {
  rowNumber: number;
  sku: string;
  action: ProductImportRowPlan["action"];
  status: "OK" | "FAILED";
  productId: string | null;
  message: string;
};

export type ProductImportCommitResult = {
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    createdCategories: number;
    createdSubcategories: number;
  };
  rows: ProductImportRowResult[];
};

function errorMessage(error: unknown) {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === "string") {
      return response;
    }
    const message = (response as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.join(", ");
    }
    if (typeof message === "string") {
      return message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

@Injectable()
export class ProductImportService {
  constructor(
    @Inject(ProductImportRepository)
    private readonly productImportRepository: ProductImportRepository,
    @Inject(UnitRepository)
    private readonly unitRepository: UnitRepository,
    @Inject(TaxRepository)
    private readonly taxRepository: TaxRepository,
    @Inject(ProductCategoryRepository)
    private readonly productCategoryRepository: ProductCategoryRepository,
    @Inject(ProductSubcategoryRepository)
    private readonly productSubcategoryRepository: ProductSubcategoryRepository,
    @Inject(ProductCategoryService)
    private readonly productCategoryService: ProductCategoryService,
    @Inject(ProductSubcategoryService)
    private readonly productSubcategoryService: ProductSubcategoryService,
    @Inject(ProductService)
    private readonly productService: ProductService,
    @Inject(ProductBarcodeService)
    private readonly productBarcodeService: ProductBarcodeService,
    @Inject(StockAdjustmentService)
    private readonly stockAdjustmentService: StockAdjustmentService,
    @Inject(AccessControlService)
    private readonly accessControl: AccessControlService
  ) {}

  private async loadBaseCatalogs(tenantId: string) {
    const today = todayInBusinessTimeZone();
    const [
      units,
      taxes,
      fiscalCategories,
      fiscalCategoryTaxLinks,
      categories,
      subcategories,
      branches,
    ] = await Promise.all([
      this.unitRepository.findAllByTenant(tenantId),
      this.taxRepository.findAllByTenant(tenantId),
      this.taxRepository.listProductCategories(),
      this.taxRepository.listActiveCategoryRateLinks(tenantId, today),
      this.productCategoryRepository.findMany(tenantId),
      this.productSubcategoryRepository.findMany(tenantId),
      this.productImportRepository.listBranches(tenantId),
    ]);

    return {
      today,
      units: units.map((unit) => ({
        id: unit.id,
        name: unit.name,
        abbreviation: unit.abbreviation,
        isActive: unit.isActive !== false,
      })),
      taxes: taxes.map((tax) => ({
        id: tax.id,
        name: tax.name,
        rate: Number(tax.rate),
        isIncluded: Boolean(tax.isIncluded),
        isActive: tax.isActive !== false,
        taxTypeCode: tax.taxTypeCode ?? null,
        calculationMethodCode: tax.calculationMethodCode ?? null,
      })),
      fiscalCategories: fiscalCategories
        .filter((item) => item.isActive)
        .map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          isAlcoholicBeverage: Boolean(item.isAlcoholicBeverage),
        })),
      fiscalCategoryTaxLinks,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
      })),
      subcategories: subcategories.map((subcategory) => ({
        id: subcategory.id,
        categoryId: subcategory.categoryId,
        name: subcategory.name,
        slug: subcategory.slug,
      })),
      branches,
    };
  }

  private async resolveAccessibleBranchIds(
    actor: AccessActor,
    tenantId: string,
    branches: ProductImportCatalogs["branches"]
  ) {
    const allowed = new Set<string>();
    for (const branch of branches) {
      if (await this.accessControl.canAccessBranch(actor, tenantId, branch.id)) {
        allowed.add(branch.id);
      }
    }
    return allowed;
  }

  private async loadCatalogs(
    tenantId: string,
    actor: AccessActor,
    rows: ProductImportRawRow[]
  ): Promise<{ catalogs: ProductImportCatalogs; today: string }> {
    const skus = [
      ...new Set(
        rows
          .map((row) => row.values.sku?.trim().toUpperCase())
          .filter((sku): sku is string => Boolean(sku))
      ),
    ];
    const barcodes = [
      ...new Set(
        rows
          .map((row) => row.values.codigo_barras?.trim())
          .filter((barcode): barcode is string => Boolean(barcode))
      ),
    ];

    const [base, existingProducts, existingBarcodes] = await Promise.all([
      this.loadBaseCatalogs(tenantId),
      this.productImportRepository.listProductsBySkus(tenantId, skus),
      this.productImportRepository.listActiveBarcodes(tenantId, barcodes),
    ]);
    const { today, ...catalogs } = base;

    return {
      today,
      catalogs: {
        ...catalogs,
        accessibleBranchIds: await this.resolveAccessibleBranchIds(
          actor,
          tenantId,
          catalogs.branches
        ),
        existingProducts,
        existingBarcodes,
      },
    };
  }

  async validate(
    tenantId: string,
    actor: AccessActor,
    buffer: Buffer
  ): Promise<ProductImportValidation> {
    let parsed;
    try {
      parsed = await parseProductImportWorkbook(buffer);
    } catch (error) {
      if (error instanceof ProductImportParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const { catalogs, today } = await this.loadCatalogs(
      tenantId,
      actor,
      parsed.rows
    );

    return {
      report: resolveProductImport(parsed.rows, catalogs, { today }),
      ignoredHeaders: parsed.ignoredHeaders,
    };
  }

  private async createMissingClassification(
    tenantId: string,
    report: ProductImportReport
  ) {
    const categoryIds = new Map<string, string>();
    for (const plan of report.rows) {
      if (plan.category?.id) {
        categoryIds.set(plan.category.slug, plan.category.id);
      }
    }

    for (const category of report.newCategories) {
      const existing = await this.productCategoryRepository.findBySlug(
        tenantId,
        category.slug
      );
      const created =
        existing ??
        (await this.productCategoryService.create({
          tenantId,
          name: category.name,
          slug: category.slug,
        }));
      if (!created) {
        throw new BadRequestException(
          `No se pudo crear la categoría "${category.name}".`
        );
      }
      categoryIds.set(category.slug, created.id);
    }

    const subcategoryIds = new Map<string, string>();
    for (const subcategory of report.newSubcategories) {
      const categoryId = categoryIds.get(subcategory.categorySlug);
      if (!categoryId) {
        throw new BadRequestException(
          `No se encontró la categoría "${subcategory.categoryName}".`
        );
      }
      const existing = await this.productSubcategoryRepository.findBySlug(
        tenantId,
        categoryId,
        subcategory.slug
      );
      const created =
        existing ??
        (await this.productSubcategoryService.create({
          tenantId,
          categoryId,
          name: subcategory.name,
          slug: subcategory.slug,
        }));
      if (!created) {
        throw new BadRequestException(
          `No se pudo crear la subcategoría "${subcategory.name}".`
        );
      }
      subcategoryIds.set(`${subcategory.categorySlug}/${subcategory.slug}`, created.id);
    }

    return { categoryIds, subcategoryIds };
  }

  private resolveClassificationIds(
    plan: ProductImportRowPlan,
    ids: {
      categoryIds: Map<string, string>;
      subcategoryIds: Map<string, string>;
    }
  ) {
    if (!plan.category) {
      return null;
    }
    const categoryId = plan.category.id ?? ids.categoryIds.get(plan.category.slug);
    const subcategoryId = plan.subcategory
      ? plan.subcategory.id ??
        ids.subcategoryIds.get(`${plan.category.slug}/${plan.subcategory.slug}`)
      : null;
    return {
      categoryId: categoryId ?? null,
      subcategoryId: subcategoryId ?? null,
    };
  }

  private async createProduct(
    tenantId: string,
    plan: ProductImportRowPlan,
    classification: { categoryId: string | null; subcategoryId: string | null } | null
  ) {
    const { product } = plan;
    const created = await this.productService.createProduct({
      tenantId,
      unitId: product.unitId as string,
      name: product.name,
      description: product.description ?? null,
      sku: product.sku,
      standardIdentification: product.standardIdentification ?? null,
      price: product.price as number,
      cost: product.cost as number,
      isActive: product.isActive,
      isPerishable: product.isPerishable,
      requiresLot: product.requiresLot,
      requiresExpiration: product.requiresExpiration,
      saleType: product.saleType,
      measurementUnit: product.measurementUnit,
      minStock: product.minStock ?? null,
      maxStock: product.maxStock ?? null,
      categoryId: classification?.categoryId ?? null,
      subcategoryId: classification?.subcategoryId ?? null,
      taxes: (plan.taxes ?? []).map((tax) => ({
        taxId: tax.taxId,
        calculationOrder: tax.calculationOrder,
        isIncluded: tax.isIncluded,
      })),
      taxProfile: plan.taxProfile ?? null,
    });
    return created.id;
  }

  private async updateProduct(
    tenantId: string,
    userId: string,
    plan: ProductImportRowPlan,
    classification: { categoryId: string | null; subcategoryId: string | null } | null
  ) {
    const productId = plan.productId as string;
    const { product } = plan;
    const payload: Record<string, unknown> = { name: product.name };

    const optionalFields = [
      "description",
      "unitId",
      "cost",
      "saleType",
      "measurementUnit",
      "standardIdentification",
      "requiresLot",
      "requiresExpiration",
      "isPerishable",
      "minStock",
      "maxStock",
      "isActive",
    ] as const;
    for (const field of optionalFields) {
      if (product[field] !== undefined) {
        payload[field] = product[field];
      }
    }
    if (classification) {
      payload.categoryId = classification.categoryId;
      payload.subcategoryId = classification.subcategoryId;
    }
    if (plan.taxes !== null) {
      payload.taxes = plan.taxes.map((tax) => ({
        taxId: tax.taxId,
        calculationOrder: tax.calculationOrder,
        isIncluded: tax.isIncluded,
      }));
    }
    if (plan.taxProfile !== undefined) {
      payload.taxProfile = plan.taxProfile;
    }

    await this.productService.updateProduct(
      productId,
      tenantId,
      payload as Parameters<ProductService["updateProduct"]>[2]
    );

    if (plan.priceChanged && product.price !== undefined) {
      await this.productService.changePrice(productId, tenantId, userId, {
        newPrice: product.price,
        reason: PRODUCT_IMPORT_REASON,
      });
    }
    return productId;
  }

  private async applyRow(
    tenantId: string,
    userId: string,
    plan: ProductImportRowPlan,
    ids: {
      categoryIds: Map<string, string>;
      subcategoryIds: Map<string, string>;
    }
  ): Promise<ProductImportRowResult> {
    const classification = this.resolveClassificationIds(plan, ids);
    let productId: string | null = plan.productId;
    let step = plan.action === "CREATE" ? "crear producto" : "actualizar producto";
    const done: string[] = [];

    try {
      productId =
        plan.action === "CREATE"
          ? await this.createProduct(tenantId, plan, classification)
          : await this.updateProduct(tenantId, userId, plan, classification);
      done.push(plan.action === "CREATE" ? "Producto creado" : "Producto actualizado");

      if (plan.barcode) {
        step = "registrar código de barras";
        await this.productBarcodeService.create({
          tenantId,
          productId,
          barcode: plan.barcode,
          isPrimary: true,
        });
        done.push("código de barras registrado");
      }

      if (plan.stock) {
        step = "cargar stock";
        await this.stockAdjustmentService.create({
          tenantId,
          productId,
          branchId: plan.stock.branchId,
          type: "IN",
          quantity: plan.stock.quantity,
          reason: PRODUCT_IMPORT_REASON,
          lotCode: plan.stock.lotCode,
          expirationDate: plan.stock.expirationDate,
          unitCost: plan.stock.unitCost ?? undefined,
          context: { tenantId, branchId: plan.stock.branchId, userId },
        });
        done.push(`stock ${plan.stock.quantity} en ${plan.stock.branchCode}`);
      }

      return {
        rowNumber: plan.rowNumber,
        sku: plan.sku,
        action: plan.action,
        status: "OK",
        productId,
        message: done.join(", ") + ".",
      };
    } catch (error) {
      const prefix = done.length > 0 ? `${done.join(", ")}; ` : "";
      return {
        rowNumber: plan.rowNumber,
        sku: plan.sku,
        action: plan.action,
        status: "FAILED",
        productId,
        message: `${prefix}falló al ${step}: ${errorMessage(error)}`,
      };
    }
  }

  async commit(
    tenantId: string,
    actor: AccessActor,
    buffer: Buffer
  ): Promise<ProductImportCommitResult> {
    const userId = actor.id;
    if (!userId) {
      throw new BadRequestException("userId is required");
    }

    const { report } = await this.validate(tenantId, actor, buffer);
    if (!report.canCommit) {
      throw new BadRequestException({
        message:
          "La carga tiene errores. Corrija el archivo y vuelva a prevalidar.",
        report,
      });
    }

    const ids = await this.createMissingClassification(tenantId, report);
    const rows: ProductImportRowResult[] = [];
    for (const plan of report.rows) {
      rows.push(await this.applyRow(tenantId, userId, plan, ids));
    }

    const succeeded = rows.filter((row) => row.status === "OK").length;
    return {
      summary: {
        total: rows.length,
        succeeded,
        failed: rows.length - succeeded,
        createdCategories: report.newCategories.length,
        createdSubcategories: report.newSubcategories.length,
      },
      rows,
    };
  }

  async buildTemplate(tenantId: string): Promise<Buffer> {
    const catalogs = await this.loadBaseCatalogs(tenantId);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Manus Tienda";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(PRODUCT_IMPORT_SHEET_NAME, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = PRODUCT_IMPORT_COLUMNS.map((column) => ({
      header: column.key,
      key: column.key,
      width: Math.max(14, column.key.length + 4),
    }));
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    PRODUCT_IMPORT_COLUMNS.forEach((column, index) => {
      const cell = header.getCell(index + 1);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: column.required ? "FFB91C1C" : "FF334155" },
      };
      cell.note = column.description;
    });

    const catalogSheet = workbook.addWorksheet("Catalogos");
    this.fillCatalogSheet(catalogSheet, catalogs);
    this.addTemplateValidations(sheet, catalogs);

    const instructions = workbook.addWorksheet("Instrucciones");
    instructions.columns = [
      { header: "Campo", key: "key", width: 24 },
      { header: "Grupo", key: "group", width: 16 },
      { header: "Obligatorio", key: "required", width: 12 },
      { header: "Descripción", key: "description", width: 90 },
      { header: "Ejemplo", key: "example", width: 26 },
    ];
    instructions.getRow(1).font = { bold: true };
    PRODUCT_IMPORT_COLUMNS.forEach((column) =>
      instructions.addRow({
        key: column.key,
        group: column.group,
        required: column.required ? "SI" : "NO",
        description: column.description,
        example: column.example,
      })
    );
    instructions.addRow({});
    [
      "Si el SKU ya existe en la empresa, el producto se actualiza. Las columnas vacías no cambian el valor actual.",
      "Al actualizar, los impuestos solo se reemplazan si viene iva o categoria_fiscal.",
      "Primero se prevalida el archivo. Solo se puede confirmar la carga si no hay errores.",
      "El stock se suma como ajuste de entrada; si carga el mismo archivo dos veces, el stock se suma dos veces.",
    ].forEach((note) => instructions.addRow({ key: "Nota", description: note }));

    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output as ArrayBuffer);
  }

  private fillCatalogSheet(
    sheet: ExcelJS.Worksheet,
    catalogs: Awaited<ReturnType<ProductImportService["loadBaseCatalogs"]>>
  ) {
    const blocks: Array<{ title: string[]; rows: Array<Array<string | number>> }> =
      [
        {
          title: ["unidad", "nombre unidad"],
          rows: catalogs.units
            .filter((unit) => unit.isActive)
            .map((unit) => [unit.abbreviation, unit.name]),
        },
        {
          title: ["iva", "impuesto"],
          rows: catalogs.taxes
            .filter(
              (tax) =>
                tax.isActive &&
                (tax.taxTypeCode === "VAT" ||
                  (tax.taxTypeCode === null && /iva|exent/i.test(tax.name)))
            )
            .map((tax) => [
              Number(((tax.rate > 1 ? tax.rate / 100 : tax.rate) * 100).toFixed(4)),
              tax.name,
            ]),
        },
        {
          title: ["categoria_fiscal", "nombre", "bebida alcohólica"],
          rows: catalogs.fiscalCategories.map((item) => [
            item.code,
            item.name,
            item.isAlcoholicBeverage ? "SI" : "NO",
          ]),
        },
        {
          title: ["categoria", "subcategoria"],
          rows: catalogs.categories.flatMap((category) => {
            const children = catalogs.subcategories.filter(
              (subcategory) => subcategory.categoryId === category.id
            );
            return children.length > 0
              ? children.map((subcategory) => [category.name, subcategory.name])
              : [[category.name, ""]];
          }),
        },
        {
          title: ["sucursal", "nombre sucursal"],
          rows: catalogs.branches
            .filter((branch) => branch.isActive)
            .map((branch) => [branch.code, branch.name]),
        },
      ];

    let column = 1;
    for (const block of blocks) {
      block.title.forEach((title, offset) => {
        const cell = sheet.getCell(1, column + offset);
        cell.value = title;
        cell.font = { bold: true };
        sheet.getColumn(column + offset).width = 22;
      });
      block.rows.forEach((values, rowIndex) => {
        values.forEach((value, offset) => {
          sheet.getCell(rowIndex + 2, column + offset).value = value;
        });
      });
      column += block.title.length + 1;
    }
  }

  private addTemplateValidations(
    sheet: ExcelJS.Worksheet,
    catalogs: Awaited<ReturnType<ProductImportService["loadBaseCatalogs"]>>
  ) {
    const columnIndex = (key: string) =>
      PRODUCT_IMPORT_COLUMNS.findIndex((column) => column.key === key) + 1;
    const listRange = (column: string, count: number) =>
      count > 0 ? [`Catalogos!$${column}$2:$${column}$${count + 1}`] : null;

    const activeUnits = catalogs.units.filter((unit) => unit.isActive).length;
    const activeBranches = catalogs.branches.filter((branch) => branch.isActive).length;
    const yesNo = ['"SI,NO"'];
    const validations: Array<[string, string[] | null]> = [
      ["unidad", listRange("A", activeUnits)],
      ["modelo_venta", ['"UNIDAD,PESO,MIXTO"']],
      ["unidad_comercial", ['"UND,KG,LB,G,OZ"']],
      ["estandar_dian", ['"001,010,020,999"']],
      ["categoria_fiscal", listRange("G", catalogs.fiscalCategories.length)],
      ["requiere_lote", yesNo],
      ["requiere_vencimiento", yesNo],
      ["perecedero", yesNo],
      ["activo", yesNo],
      ["sucursal", listRange("N", activeBranches)],
    ];

    for (const [key, formulae] of validations) {
      const column = columnIndex(key);
      if (!formulae || column <= 0) {
        continue;
      }
      for (let row = 2; row <= TEMPLATE_VALIDATION_ROWS + 1; row += 1) {
        sheet.getCell(row, column).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae,
          showErrorMessage: false,
        };
      }
    }
  }
}
