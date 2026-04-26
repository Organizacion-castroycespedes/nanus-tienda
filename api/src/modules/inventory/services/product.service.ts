import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import { ProductEntity, type ProductProps } from "../entities/product.entity";
import { ProductRepository } from "../repositories/product.repository";
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
  >
>;

@Injectable()
export class ProductService {
  constructor(
    @Inject(ProductRepository)
    private readonly productRepository: ProductRepository,
    @Inject(StockMovementService)
    private readonly stockMovementService: StockMovementService
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

  async createProduct(product: CreateProductInput) {
    this.validateName(product.name);
    this.assertNonNegative(product.price, "price");
    this.assertNonNegative(product.cost, "cost");

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

    const entity = ProductEntity.create({
      ...product,
      id: crypto.randomUUID(),
      sku: normalizedSku,
      name: product.name.trim(),
      priceWithTax,
      priceWithoutTax,
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
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  async listProducts(tenantId: string) {
    const products = await this.productRepository.findAllByTenant(tenantId);

    return Promise.all(
      products.map(async (product) => {
        const stockResult = await this.stockMovementService.getStockByProduct(
          product.id,
          tenantId
        );

        return {
          ...product,
          stock: stockResult.stock,
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

  async getProductWithStock(id: string, tenantId: string) {
    const product = await this.getProductById(id, tenantId);
    const stockResult = await this.stockMovementService.getStockByProduct(
      id,
      tenantId
    );

    return {
      ...product,
      stock: stockResult.stock,
    };
  }

  async updateProduct(
    id: string,
    tenantId: string,
    data: UpdateProductInput
  ) {
    const current = await this.productRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("product not found");
    }

    if (data.name !== undefined) {
      this.validateName(data.name);
    }

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

    const updated = await this.productRepository.update(id, tenantId, data);
    if (!updated) {
      throw new NotFoundException("product not found");
    }

    return updated;
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
