import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import { DatabaseService } from "../../../common/db/database.service";
import {
  PRODUCT_BARCODE_TYPES,
  ProductBarcodeEntity,
  type ProductBarcodeType,
} from "../entities/product-barcode.entity";
import { ProductBarcodeRepository } from "../repositories/product-barcode.repository";
import { ProductRepository } from "../repositories/product.repository";

type CreateProductBarcodeInput = {
  tenantId: string;
  productId: string;
  barcode: string;
  barcodeType?: ProductBarcodeType;
  isPrimary?: boolean;
};

type UpdateProductBarcodeInput = {
  tenantId: string;
  productId: string;
  barcodeId: string;
  barcode?: string;
  barcodeType?: ProductBarcodeType;
  isPrimary?: boolean;
};

type ProductBarcodePayload = {
  barcode: string;
  barcodeType: ProductBarcodeType;
  isPrimary: boolean;
};

@Injectable()
export class ProductBarcodeService {
  constructor(
    @Inject(ProductBarcodeRepository)
    private readonly productBarcodeRepository: ProductBarcodeRepository,
    @Inject(ProductRepository)
    private readonly productRepository: ProductRepository,
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  private normalizeBarcode(barcode: string | undefined) {
    const normalized = barcode?.trim();
    if (!normalized) {
      throw new BadRequestException("barcode is required");
    }
    return normalized;
  }

  private normalizeBarcodeType(type: ProductBarcodeType | undefined) {
    const normalized = type ?? "UNIT";
    if (!PRODUCT_BARCODE_TYPES.includes(normalized)) {
      throw new BadRequestException("barcodeType is invalid");
    }
    return normalized;
  }

  private assertBoolean(value: boolean | undefined, field: string) {
    if (value === undefined) {
      return;
    }
    if (typeof value !== "boolean") {
      throw new BadRequestException(`${field} must be a boolean`);
    }
  }

  private async assertProductBelongsToTenant(
    tenantId: string,
    productId: string
  ) {
    const product = await this.productRepository.findById(productId, tenantId);
    if (!product) {
      throw new NotFoundException("product not found");
    }
  }

  private assertBarcodeBelongsToProduct(
    barcode: ProductBarcodeEntity | null,
    productId: string
  ): ProductBarcodeEntity {
    if (!barcode || barcode.productId !== productId) {
      throw new NotFoundException("barcode not found");
    }
    return barcode;
  }

  private async assertBarcodeNotActiveDuplicate(
    tenantId: string,
    barcode: string,
    currentBarcodeId?: string
  ) {
    const existing =
      await this.productBarcodeRepository.findActiveByBarcode(
        tenantId,
        barcode
      );

    if (existing && existing.id !== currentBarcodeId) {
      throw new BadRequestException("barcode already exists for this tenant");
    }
  }

  private buildCreatePayload(
    input: CreateProductBarcodeInput
  ): ProductBarcodePayload {
    this.assertBoolean(input.isPrimary, "isPrimary");

    return {
      barcode: this.normalizeBarcode(input.barcode),
      barcodeType: this.normalizeBarcodeType(input.barcodeType),
      isPrimary: input.isPrimary ?? false,
    };
  }

  private buildUpdatePayload(input: UpdateProductBarcodeInput) {
    this.assertBoolean(input.isPrimary, "isPrimary");

    return {
      barcode:
        input.barcode !== undefined
          ? this.normalizeBarcode(input.barcode)
          : undefined,
      barcodeType:
        input.barcodeType !== undefined
          ? this.normalizeBarcodeType(input.barcodeType)
          : undefined,
      isPrimary: input.isPrimary,
    };
  }

  async findByProduct(tenantId: string, productId: string) {
    await this.assertProductBelongsToTenant(tenantId, productId);
    return this.productBarcodeRepository.findByProduct(tenantId, productId);
  }

  async create(input: CreateProductBarcodeInput) {
    await this.assertProductBelongsToTenant(input.tenantId, input.productId);
    const payload = this.buildCreatePayload(input);
    await this.assertBarcodeNotActiveDuplicate(input.tenantId, payload.barcode);

    const now = new Date();
    const barcode = ProductBarcodeEntity.create({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      productId: input.productId,
      barcode: payload.barcode,
      barcodeType: payload.barcodeType,
      isPrimary: payload.isPrimary,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      if (barcode.isPrimary) {
        await this.productBarcodeRepository.unsetPrimaryForProduct(
          barcode.tenantId,
          barcode.productId,
          undefined,
          client
        );
      }
      const created = await this.productBarcodeRepository.create(
        {
          id: barcode.id,
          tenantId: barcode.tenantId,
          productId: barcode.productId,
          barcode: barcode.barcode,
          barcodeType: barcode.barcodeType,
          isPrimary: barcode.isPrimary,
          isActive: barcode.isActive,
          createdAt: barcode.createdAt,
          updatedAt: barcode.updatedAt,
        },
        client
      );
      await client.query("COMMIT");
      return created;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(input: UpdateProductBarcodeInput) {
    await this.assertProductBelongsToTenant(input.tenantId, input.productId);
    const current = this.assertBarcodeBelongsToProduct(
      await this.productBarcodeRepository.findById(
        input.tenantId,
        input.barcodeId
      ),
      input.productId
    );
    const payload = this.buildUpdatePayload(input);

    if (payload.barcode !== undefined) {
      await this.assertBarcodeNotActiveDuplicate(
        input.tenantId,
        payload.barcode,
        input.barcodeId
      );
    }

    if (payload.isPrimary === true && !current.isActive) {
      throw new BadRequestException("inactive barcode cannot be primary");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      if (payload.isPrimary === true) {
        await this.productBarcodeRepository.unsetPrimaryForProduct(
          input.tenantId,
          input.productId,
          input.barcodeId,
          client
        );
      }

      const updated = await this.productBarcodeRepository.update(
        input.tenantId,
        input.barcodeId,
        {
          barcode: payload.barcode,
          barcodeType: payload.barcodeType,
          isPrimary: payload.isPrimary,
        },
        client
      );
      await client.query("COMMIT");

      return this.assertBarcodeBelongsToProduct(updated, input.productId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deactivate(tenantId: string, productId: string, barcodeId: string) {
    await this.assertProductBelongsToTenant(tenantId, productId);
    this.assertBarcodeBelongsToProduct(
      await this.productBarcodeRepository.findById(tenantId, barcodeId),
      productId
    );

    const deactivated = await this.productBarcodeRepository.deactivate(
      tenantId,
      barcodeId
    );
    return this.assertBarcodeBelongsToProduct(deactivated, productId);
  }

  async setPrimary(tenantId: string, productId: string, barcodeId: string) {
    await this.assertProductBelongsToTenant(tenantId, productId);
    const current = this.assertBarcodeBelongsToProduct(
      await this.productBarcodeRepository.findById(tenantId, barcodeId),
      productId
    );
    if (!current.isActive) {
      throw new BadRequestException("inactive barcode cannot be primary");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      await this.productBarcodeRepository.unsetPrimaryForProduct(
        tenantId,
        productId,
        barcodeId,
        client
      );
      const updated = await this.productBarcodeRepository.setPrimary(
        tenantId,
        productId,
        barcodeId,
        client
      );
      await client.query("COMMIT");

      return this.assertBarcodeBelongsToProduct(updated, productId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
