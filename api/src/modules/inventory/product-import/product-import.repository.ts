import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../common/db/database.service";
import type {
  ProductMeasurementUnit,
  ProductSaleType,
} from "../entities/product.entity";
import type { ProductImportCatalogs } from "./product-import.resolver";

type BranchRow = {
  id: string;
  codigo: string;
  nombre: string;
  estado: string | null;
};

type ExistingProductRow = {
  id: string;
  sku: string;
  price: string | number;
  sale_type: ProductSaleType | null;
  measurement_unit: ProductMeasurementUnit | null;
  requires_lot: boolean | null;
  requires_expiration: boolean | null;
  is_perishable: boolean | null;
  category_id: string | null;
  subcategory_id: string | null;
};

@Injectable()
export class ProductImportRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService
  ) {}

  async listBranches(
    tenantId: string
  ): Promise<ProductImportCatalogs["branches"]> {
    const result = await this.db.query<BranchRow>(
      `
        SELECT id, codigo, nombre, estado
        FROM tenant_branches
        WHERE tenant_id = $1
        ORDER BY es_principal DESC, nombre ASC
      `,
      [tenantId]
    );

    return (result.rows ?? []).map((row) => ({
      id: row.id,
      code: row.codigo,
      name: row.nombre,
      isActive: (row.estado ?? "ACTIVE").toUpperCase() === "ACTIVE",
    }));
  }

  async listProductsBySkus(
    tenantId: string,
    skus: string[]
  ): Promise<ProductImportCatalogs["existingProducts"]> {
    if (skus.length === 0) {
      return [];
    }

    const result = await this.db.query<ExistingProductRow>(
      `
        SELECT
          id,
          sku,
          price,
          sale_type,
          measurement_unit,
          requires_lot,
          requires_expiration,
          is_perishable,
          category_id,
          subcategory_id
        FROM products
        WHERE tenant_id = $1
          AND UPPER(BTRIM(sku)) = ANY($2::text[])
      `,
      [tenantId, skus]
    );

    return (result.rows ?? []).map((row) => ({
      id: row.id,
      sku: row.sku,
      price: Number(row.price),
      saleType: row.sale_type ?? "UNIT",
      measurementUnit: row.measurement_unit ?? "UND",
      requiresLot: Boolean(row.requires_lot),
      requiresExpiration: Boolean(row.requires_expiration),
      isPerishable: Boolean(row.is_perishable),
      categoryId: row.category_id,
      subcategoryId: row.subcategory_id,
    }));
  }

  async listActiveBarcodes(
    tenantId: string,
    barcodes: string[]
  ): Promise<ProductImportCatalogs["existingBarcodes"]> {
    if (barcodes.length === 0) {
      return [];
    }

    const result = await this.db.query<{ barcode: string; product_id: string }>(
      `
        SELECT barcode, product_id
        FROM product_barcodes
        WHERE tenant_id = $1
          AND is_active = TRUE
          AND barcode = ANY($2::text[])
      `,
      [tenantId, barcodes]
    );

    return (result.rows ?? []).map((row) => ({
      barcode: row.barcode,
      productId: row.product_id,
    }));
  }
}
