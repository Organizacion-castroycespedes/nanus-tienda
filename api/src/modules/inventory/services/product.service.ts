import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import { DatabaseService } from "../../../common/db/database.service";
import {
  PRODUCT_OPERATIONAL_STATUSES,
  PRODUCT_MEASUREMENT_UNITS,
  PRODUCT_ROTATION_CLASSES,
  PRODUCT_SALE_TYPES,
  ProductEntity,
  type ProductMeasurementUnit,
  type ProductOperationalStatus,
  type ProductProps,
  type ProductRotationClass,
  type ProductSaleType,
} from "../entities/product.entity";
import {
  PRODUCT_IMAGE_MIME_TYPES,
  type ProductImageMimeType,
} from "../entities/product-category.entity";
import type { ProductBarcodeEntity } from "../entities/product-barcode.entity";
import { ProductBarcodeRepository } from "../repositories/product-barcode.repository";
import { ProductCategoryRepository } from "../repositories/product-category.repository";
import { ProductRepository } from "../repositories/product.repository";
import { ProductSubcategoryRepository } from "../repositories/product-subcategory.repository";
import { StockMovementService } from "./stock-movement.service";

type CreateProductInput = {
  tenantId: string;
  unitId: string;
  taxId?: string | null;
  name: string;
  description?: string | null;
  sku: string;
  price: number;
  cost: number;
  priceWithTax?: number;
  priceWithoutTax?: number;
  isActive?: boolean;
  isPerishable?: boolean;
  requiresLot?: boolean;
  requiresExpiration?: boolean;
  operationalStatus?: ProductOperationalStatus;
  rotationClass?: ProductRotationClass;
  saleType?: ProductSaleType;
  measurementUnit?: ProductMeasurementUnit;
  minStock?: number | null;
  maxStock?: number | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  imageUrl?: string | null;
  imageStorageKey?: string | null;
  imageAltText?: string | null;
  imageMimeType?: ProductImageMimeType | null;
  imageSizeBytes?: number | null;
  imageUpdatedAt?: Date | null;
};

type UpdateProductInput = Partial<
  Pick<
    ProductProps,
    | "unitId"
    | "taxId"
    | "name"
    | "description"
    | "sku"
    | "price"
    | "cost"
    | "priceWithTax"
    | "priceWithoutTax"
    | "isActive"
    | "isPerishable"
    | "requiresLot"
    | "requiresExpiration"
    | "operationalStatus"
    | "rotationClass"
    | "saleType"
    | "measurementUnit"
    | "minStock"
    | "maxStock"
    | "categoryId"
    | "subcategoryId"
    | "imageUrl"
    | "imageStorageKey"
    | "imageAltText"
    | "imageMimeType"
    | "imageSizeBytes"
    | "imageUpdatedAt"
  >
>;

type ProductUpdatePayload = UpdateProductInput & Record<string, unknown>;

type ProductOperationalRules = {
  isPerishable: boolean;
  requiresLot: boolean;
  requiresExpiration: boolean;
  operationalStatus: ProductOperationalStatus;
  rotationClass: ProductRotationClass;
  minStock: number | null;
  maxStock: number | null;
};

type ProductSaleModelRules = {
  saleType: ProductSaleType;
  measurementUnit: ProductMeasurementUnit;
};

type PosProductBarcode = {
  code: string;
  barcode: string;
  barcodeType: ProductBarcodeEntity["barcodeType"];
  isPrimary: boolean;
  isActive: boolean;
};

@Injectable()
export class ProductService {
  constructor(
    @Inject(ProductRepository)
    private readonly productRepository: ProductRepository,
    @Inject(StockMovementService)
    private readonly stockMovementService: StockMovementService,
    @Inject(ProductBarcodeRepository)
    private readonly productBarcodeRepository: ProductBarcodeRepository,
    @Inject(ProductCategoryRepository)
    private readonly productCategoryRepository: ProductCategoryRepository,
    @Inject(ProductSubcategoryRepository)
    private readonly productSubcategoryRepository: ProductSubcategoryRepository,
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  private normalizeSku(sku: string) {
    return sku.trim().toUpperCase();
  }

  private validateName(name: string | undefined) {
    if (!name?.trim()) {
      throw new BadRequestException("name is required");
    }
  }

  private assertNonNegative(value: number | undefined, field: string) {
    if (value === undefined || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${field} must be a non-negative number`);
    }
  }

  private validatePriceChangeReason(reason: string | undefined) {
    if (!reason?.trim() || reason.trim().length < 5) {
      throw new BadRequestException(
        "reason must be at least 5 characters long"
      );
    }
  }

  private assertNoDirectPriceUpdate(data: ProductUpdatePayload) {
    const blockedFields = [
      "price",
      "priceWithTax",
      "priceWithoutTax",
      "price_with_tax",
      "price_without_tax",
    ];
    const attemptedFields = blockedFields.filter((field) =>
      Object.prototype.hasOwnProperty.call(data, field)
    );

    if (attemptedFields.length > 0) {
      throw new BadRequestException(
        `price updates must use /products/:id/change-price; blocked fields: ${attemptedFields.join(", ")}`
      );
    }
  }

  private assertOptionalNonNegative(
    value: number | null | undefined,
    field: string
  ) {
    if (value === undefined || value === null) {
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${field} must be a non-negative number`);
    }
  }

  private normalizeNullableText(value: string | null | undefined) {
    if (value === null) {
      return null;
    }
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private assertOptionalImageMimeType(
    value: ProductImageMimeType | null | undefined,
    field: string
  ) {
    if (value === undefined || value === null) {
      return;
    }
    if (!PRODUCT_IMAGE_MIME_TYPES.includes(value)) {
      throw new BadRequestException(`${field} is invalid`);
    }
  }

  private assertOptionalBoolean(
    value: boolean | null | undefined,
    field: string
  ) {
    if (value === undefined) {
      return;
    }
    if (typeof value !== "boolean") {
      throw new BadRequestException(`${field} must be a boolean`);
    }
  }

  private assertOperationalStatus(value: ProductOperationalStatus) {
    if (!PRODUCT_OPERATIONAL_STATUSES.includes(value)) {
      throw new BadRequestException("operationalStatus is invalid");
    }
  }

  private assertRotationClass(value: ProductRotationClass) {
    if (value !== null && !PRODUCT_ROTATION_CLASSES.includes(value)) {
      throw new BadRequestException("rotationClass is invalid");
    }
  }

  private assertSaleType(value: ProductSaleType) {
    if (!PRODUCT_SALE_TYPES.includes(value)) {
      throw new BadRequestException("saleType is invalid");
    }
  }

  private assertMeasurementUnit(value: ProductMeasurementUnit) {
    if (!PRODUCT_MEASUREMENT_UNITS.includes(value)) {
      throw new BadRequestException("measurementUnit is invalid");
    }
  }

  private validateSaleModel(rules: ProductSaleModelRules) {
    this.assertSaleType(rules.saleType);
    this.assertMeasurementUnit(rules.measurementUnit);

    if (rules.saleType === "UNIT" && rules.measurementUnit !== "UND") {
      throw new BadRequestException(
        "UNIT products must use UND measurementUnit"
      );
    }

    if (rules.saleType !== "UNIT" && rules.measurementUnit === "UND") {
      throw new BadRequestException(
        "WEIGHT or BOTH products must use KG, LB, G or OZ measurementUnit"
      );
    }
  }

  private hasOwn(data: Record<string, unknown>, field: string) {
    return Object.prototype.hasOwnProperty.call(data, field);
  }

  private hasImageMetadata(data: Record<string, unknown>) {
    return [
      "imageUrl",
      "imageStorageKey",
      "imageAltText",
      "imageMimeType",
      "imageSizeBytes",
    ].some((field) => this.hasOwn(data, field));
  }

  private validateProductImageMetadata(
    data: Partial<
      Pick<ProductProps, "imageMimeType" | "imageSizeBytes">
    >
  ) {
    this.assertOptionalImageMimeType(data.imageMimeType, "imageMimeType");
    this.assertOptionalNonNegative(data.imageSizeBytes, "imageSizeBytes");
  }

  private buildCreateImageMetadata(
    product: CreateProductInput,
    changedAt: Date
  ) {
    this.validateProductImageMetadata(product);
    const hasImageMetadata = this.hasImageMetadata(
      product as Record<string, unknown>
    );

    return {
      imageUrl: this.normalizeNullableText(product.imageUrl),
      imageStorageKey: this.normalizeNullableText(product.imageStorageKey),
      imageAltText: this.normalizeNullableText(product.imageAltText),
      imageMimeType: product.imageMimeType ?? null,
      imageSizeBytes: product.imageSizeBytes ?? null,
      imageUpdatedAt: hasImageMetadata ? changedAt : null,
    };
  }

  private buildUpdateImageMetadata(data: ProductUpdatePayload) {
    this.validateProductImageMetadata(data);
    if (!this.hasImageMetadata(data)) {
      return {};
    }

    return {
      imageUrl:
        data.imageUrl !== undefined
          ? this.normalizeNullableText(data.imageUrl)
          : undefined,
      imageStorageKey:
        data.imageStorageKey !== undefined
          ? this.normalizeNullableText(data.imageStorageKey)
          : undefined,
      imageAltText:
        data.imageAltText !== undefined
          ? this.normalizeNullableText(data.imageAltText)
          : undefined,
      imageMimeType: data.imageMimeType,
      imageSizeBytes: data.imageSizeBytes,
      imageUpdatedAt: new Date(),
    };
  }

  private async validateProductClassification(
    tenantId: string,
    categoryId: string | null,
    subcategoryId: string | null
  ) {
    if (subcategoryId !== null && categoryId === null) {
      throw new BadRequestException(
        "categoryId is required when subcategoryId is provided"
      );
    }

    if (categoryId !== null) {
      const category = await this.productCategoryRepository.findById(
        tenantId,
        categoryId
      );
      if (!category) {
        throw new BadRequestException("categoryId is invalid");
      }
    }

    if (subcategoryId !== null) {
      const subcategory = await this.productSubcategoryRepository.findById(
        tenantId,
        subcategoryId
      );
      if (!subcategory) {
        throw new BadRequestException("subcategoryId is invalid");
      }
      if (subcategory.categoryId !== categoryId) {
        throw new BadRequestException(
          "subcategoryId does not belong to categoryId"
        );
      }
    }
  }

  private validateOperationalRules(rules: ProductOperationalRules) {
    this.assertOperationalStatus(rules.operationalStatus);
    this.assertRotationClass(rules.rotationClass);
    this.assertOptionalNonNegative(rules.minStock, "minStock");
    this.assertOptionalNonNegative(rules.maxStock, "maxStock");

    if (
      rules.minStock !== null &&
      rules.maxStock !== null &&
      rules.maxStock < rules.minStock
    ) {
      throw new BadRequestException(
        "maxStock must be greater than or equal to minStock"
      );
    }

    if (rules.requiresExpiration && !rules.requiresLot) {
      throw new BadRequestException(
        "requiresLot is required when requiresExpiration is true"
      );
    }

    if (
      rules.isPerishable &&
      !rules.requiresLot &&
      !rules.requiresExpiration
    ) {
      throw new BadRequestException(
        "isPerishable requires requiresLot or requiresExpiration"
      );
    }
  }

  private groupActiveBarcodesByProduct(barcodes: ProductBarcodeEntity[]) {
    return barcodes.reduce<Record<string, PosProductBarcode[]>>(
      (acc, barcode) => {
        if (!barcode.isActive) {
          return acc;
        }

        const mapped = {
          code: barcode.barcode,
          barcode: barcode.barcode,
          barcodeType: barcode.barcodeType,
          isPrimary: barcode.isPrimary,
          isActive: barcode.isActive,
        };

        acc[barcode.productId] = [...(acc[barcode.productId] ?? []), mapped];
        return acc;
      },
      {}
    );
  }

  private buildBarcodeCatalog(barcodes: PosProductBarcode[] = []) {
    const primaryBarcode =
      barcodes.find((barcode) => barcode.isPrimary)?.code ??
      barcodes[0]?.code ??
      null;

    return {
      primaryBarcode,
      barcodeCodes: barcodes.map((barcode) => barcode.code),
      barcodes,
    };
  }

  private buildCreateOperationalRules(
    product: CreateProductInput
  ): ProductOperationalRules {
    return {
      isPerishable: product.isPerishable ?? false,
      requiresLot: product.requiresLot ?? false,
      requiresExpiration: product.requiresExpiration ?? false,
      operationalStatus: product.operationalStatus ?? "ACTIVE",
      rotationClass: product.rotationClass ?? null,
      minStock: product.minStock ?? null,
      maxStock: product.maxStock ?? null,
    };
  }

  private buildCreateSaleModel(
    product: CreateProductInput
  ): ProductSaleModelRules {
    return {
      saleType: product.saleType ?? "UNIT",
      measurementUnit: product.measurementUnit ?? "UND",
    };
  }

  private buildUpdateSaleModel(
    current: ProductEntity,
    data: UpdateProductInput
  ): ProductSaleModelRules {
    return {
      saleType: data.saleType ?? current.saleType,
      measurementUnit: data.measurementUnit ?? current.measurementUnit,
    };
  }

  private buildUpdateOperationalRules(
    current: ProductEntity,
    data: UpdateProductInput
  ): ProductOperationalRules {
    return {
      isPerishable: data.isPerishable ?? current.isPerishable,
      requiresLot: data.requiresLot ?? current.requiresLot,
      requiresExpiration:
        data.requiresExpiration ?? current.requiresExpiration,
      operationalStatus: data.operationalStatus ?? current.operationalStatus,
      rotationClass:
        data.rotationClass !== undefined
          ? data.rotationClass
          : current.rotationClass,
      minStock: data.minStock !== undefined ? data.minStock : current.minStock,
      maxStock: data.maxStock !== undefined ? data.maxStock : current.maxStock,
    };
  }

  async createProduct(product: CreateProductInput) {
    this.validateName(product.name);
    this.assertNonNegative(product.price, "price");
    this.assertNonNegative(product.cost, "cost");
    this.assertOptionalNonNegative(product.priceWithTax, "priceWithTax");
    this.assertOptionalNonNegative(product.priceWithoutTax, "priceWithoutTax");
    this.assertOptionalBoolean(product.isPerishable, "isPerishable");
    this.assertOptionalBoolean(product.requiresLot, "requiresLot");
    this.assertOptionalBoolean(
      product.requiresExpiration,
      "requiresExpiration"
    );
    const operationalRules = this.buildCreateOperationalRules(product);
    this.validateOperationalRules(operationalRules);
    const saleModel = this.buildCreateSaleModel(product);
    this.validateSaleModel(saleModel);
    await this.validateProductClassification(
      product.tenantId,
      product.categoryId ?? null,
      product.subcategoryId ?? null
    );

    const normalizedSku = this.normalizeSku(product.sku);
    const existing = await this.productRepository.findBySku(
      normalizedSku,
      product.tenantId
    );
    if (existing) {
      throw new BadRequestException("sku already exists for this tenant");
    }

    const now = new Date();
    const priceWithoutTax = product.priceWithoutTax ?? product.price;
    const priceWithTax = product.priceWithTax ?? product.price;
    const imageMetadata = this.buildCreateImageMetadata(product, now);

    const entity = ProductEntity.create({
      ...product,
      id: crypto.randomUUID(),
      sku: normalizedSku,
      name: product.name.trim(),
      priceWithTax,
      priceWithoutTax,
      ...saleModel,
      ...operationalRules,
      ...imageMetadata,
      createdAt: now,
      updatedAt: now,
    });

    return this.productRepository.create({
      id: entity.id,
      tenantId: entity.tenantId,
      unitId: entity.unitId,
      taxId: entity.taxId,
      unit: entity.unit,
      tax: entity.tax,
      name: entity.name,
      description: entity.description,
      sku: entity.sku,
      price: entity.price,
      cost: entity.cost,
      priceWithTax: entity.priceWithTax,
      priceWithoutTax: entity.priceWithoutTax,
      isActive: entity.isActive,
      isPerishable: entity.isPerishable,
      requiresLot: entity.requiresLot,
      requiresExpiration: entity.requiresExpiration,
      operationalStatus: entity.operationalStatus,
      rotationClass: entity.rotationClass,
      saleType: entity.saleType,
      measurementUnit: entity.measurementUnit,
      minStock: entity.minStock,
      maxStock: entity.maxStock,
      categoryId: entity.categoryId,
      subcategoryId: entity.subcategoryId,
      imageUrl: entity.imageUrl,
      imageStorageKey: entity.imageStorageKey,
      imageAltText: entity.imageAltText,
      imageMimeType: entity.imageMimeType,
      imageSizeBytes: entity.imageSizeBytes,
      imageUpdatedAt: entity.imageUpdatedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  async listProducts(tenantId: string, branchId: string) {
    const products = await this.productRepository.findAllByTenant(tenantId);
    const productIds = products.map((product) => product.id);
    const barcodesByProduct = this.groupActiveBarcodesByProduct(
      await this.productBarcodeRepository.findActiveByProductIds(
        tenantId,
        productIds
      )
    );

    return Promise.all(
      products.map(async (product) => {
        const stockResult = await this.stockMovementService.getStockByProduct(
          product.id,
          tenantId,
          branchId
        );

        return {
          ...product,
          stock: stockResult.stock,
          ...this.buildBarcodeCatalog(barcodesByProduct[product.id]),
        };
      })
    );
  }

  async getProductById(id: string, tenantId: string) {
    const product = await this.productRepository.findById(id, tenantId);
    if (!product) {
      throw new NotFoundException("product not found");
    }
    return product;
  }

  async getProductWithStock(id: string, tenantId: string, branchId: string) {
    const product = await this.getProductById(id, tenantId);
    const stockResult = await this.stockMovementService.getStockByProduct(
      id,
      tenantId,
      branchId
    );

    return {
      ...product,
      stock: stockResult.stock,
    };
  }

  async updateProduct(
    id: string,
    tenantId: string,
    data: ProductUpdatePayload
  ) {
    this.assertNoDirectPriceUpdate(data);

    const current = await this.productRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("product not found");
    }

    if (data.name !== undefined) {
      this.validateName(data.name);
    }
    this.assertOptionalNonNegative(data.price, "price");
    this.assertOptionalNonNegative(data.cost, "cost");
    this.assertOptionalNonNegative(data.priceWithTax, "priceWithTax");
    this.assertOptionalNonNegative(data.priceWithoutTax, "priceWithoutTax");
    this.assertOptionalBoolean(data.isPerishable, "isPerishable");
    this.assertOptionalBoolean(data.requiresLot, "requiresLot");
    this.assertOptionalBoolean(data.requiresExpiration, "requiresExpiration");

    const operationalRules = this.buildUpdateOperationalRules(current, data);
    this.validateOperationalRules(operationalRules);
    const saleModel = this.buildUpdateSaleModel(current, data);
    this.validateSaleModel(saleModel);
    const categoryWasProvided = this.hasOwn(data, "categoryId");
    const subcategoryWasProvided = this.hasOwn(data, "subcategoryId");
    const nextCategoryId = categoryWasProvided
      ? data.categoryId ?? null
      : current.categoryId;
    const nextSubcategoryId = subcategoryWasProvided
      ? data.subcategoryId ?? null
      : current.subcategoryId;

    if (
      categoryWasProvided &&
      !subcategoryWasProvided &&
      current.subcategoryId !== null &&
      nextCategoryId !== current.categoryId
    ) {
      throw new BadRequestException(
        "subcategoryId must be provided when changing categoryId"
      );
    }

    await this.validateProductClassification(
      tenantId,
      nextCategoryId,
      nextSubcategoryId
    );

    if (data.sku !== undefined) {
      const normalizedSku = this.normalizeSku(data.sku);
      const existing = await this.productRepository.findBySku(
        normalizedSku,
        tenantId
      );
      if (existing && existing.id !== id) {
        throw new BadRequestException("sku already exists for this tenant");
      }
      data = {
        ...data,
        sku: normalizedSku,
      };
    }

    const updated = await this.productRepository.update(id, tenantId, {
      ...data,
      ...this.buildUpdateImageMetadata(data),
    });
    if (!updated) {
      throw new NotFoundException("product not found");
    }

    return updated;
  }

  async changePrice(
    productId: string,
    tenantId: string,
    changedBy: string | undefined,
    data: { newPrice: number; reason: string }
  ) {
    if (!changedBy) {
      throw new BadRequestException("changedBy is required");
    }
    this.assertNonNegative(data.newPrice, "newPrice");
    this.validatePriceChangeReason(data.reason);

    const reason = data.reason.trim();
    const appliedAt = new Date();
    const client = await this.db.getClient();

    try {
      await client.query("BEGIN");

      const current = await this.productRepository.findByIdForUpdate(
        productId,
        tenantId,
        client
      );
      if (!current) {
        throw new NotFoundException("product not found");
      }

      await this.productRepository.closeCurrentPriceHistory(
        tenantId,
        productId,
        appliedAt,
        client
      );

      const history = await this.productRepository.createPriceHistory(
        {
          tenantId,
          productId,
          previousPrice: current.price,
          newPrice: data.newPrice,
          reason,
          changedBy,
          validFrom: appliedAt,
        },
        client
      );

      const updated = await this.productRepository.update(
        productId,
        tenantId,
        { price: data.newPrice },
        client
      );
      if (!updated) {
        throw new NotFoundException("product not found");
      }

      await client.query("COMMIT");

      return {
        productId,
        previousPrice: history.previousPrice,
        newPrice: history.newPrice,
        reason: history.reason,
        changedBy: history.changedBy,
        appliedAt: history.validFrom,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getPriceHistory(productId: string, tenantId: string) {
    const product = await this.productRepository.findById(productId, tenantId);
    if (!product) {
      throw new NotFoundException("product not found");
    }

    return this.productRepository.findPriceHistoryByProduct(
      tenantId,
      productId
    );
  }

  async softDeleteProduct(id: string, tenantId: string) {
    const current = await this.productRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("product not found");
    }

    const deleted = await this.productRepository.softDelete(id, tenantId);
    if (!deleted) {
      throw new NotFoundException("product not found");
    }

    return deleted;
  }
}
