import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import type { StockMovementEntity } from "../entities/stock-movement.entity";
import {
  StockMovementService,
  type InventoryContext,
} from "./stock-movement.service";
import { InventoryLotService } from "./inventory-lot.service";
import { InventoryLotBalanceService } from "./inventory-lot-balance.service";
import { StockMovementLotService } from "./stock-movement-lot.service";

type ProductAdjustmentPolicyRow = QueryResultRow & {
  id: string;
  cost: string | number | null;
  requires_lot: boolean;
  requires_expiration: boolean;
};

export type CreateStockAdjustmentInput = {
  tenantId: string;
  productId: string;
  branchId?: string | null;
  type: "IN" | "OUT";
  quantity: number;
  reason?: string | null;
  lotCode?: string | null;
  expirationDate?: string | null;
  locationId?: string | null;
  unitCost?: number;
  context?: InventoryContext;
};

type AdjustmentLotPayload = {
  lotCode: string;
  expirationDate?: string;
  locationId?: string | null;
  unitCost?: number;
};

@Injectable()
export class StockAdjustmentService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(StockMovementService)
    private readonly stockMovementService: StockMovementService,
    @Inject(InventoryLotService)
    private readonly inventoryLotService: InventoryLotService,
    @Inject(InventoryLotBalanceService)
    private readonly inventoryLotBalanceService: InventoryLotBalanceService,
    @Inject(StockMovementLotService)
    private readonly stockMovementLotService: StockMovementLotService
  ) {}

  private normalizeOptional(value: string | null | undefined) {
    if (value === null) {
      return null;
    }
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private hasLotData(input: CreateStockAdjustmentInput) {
    return (
      this.normalizeOptional(input.lotCode) !== undefined ||
      this.normalizeOptional(input.expirationDate) !== undefined ||
      this.normalizeOptional(input.locationId) !== undefined ||
      input.unitCost !== undefined
    );
  }

  private normalizeLotCode(value: string | null | undefined) {
    const normalized = this.normalizeOptional(value);
    if (!normalized) {
      throw new BadRequestException("lotCode is required for this product");
    }
    return normalized.toUpperCase();
  }

  private normalizeQuantity(value: number) {
    const quantity = Number(value);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException("quantity must be a positive number");
    }
    return quantity;
  }

  private normalizeUnitCost(value: number | undefined) {
    if (value === undefined) {
      return undefined;
    }
    const unitCost = Number(value);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new BadRequestException("unitCost must be non-negative");
    }
    return unitCost;
  }

  private validateLotPayload(
    input: CreateStockAdjustmentInput,
    policy: ProductAdjustmentPolicyRow
  ): AdjustmentLotPayload | null {
    if (!policy.requires_lot) {
      if (this.hasLotData(input)) {
        throw new BadRequestException(
          "lot data is not allowed for products without lot control"
        );
      }
      return null;
    }

    if (!input.branchId?.trim()) {
      throw new BadRequestException("branchId is required for lot adjustment");
    }

    const lotCode = this.normalizeLotCode(input.lotCode);
    const expirationDate = this.normalizeOptional(input.expirationDate);
    if (
      input.type === "IN" &&
      policy.requires_expiration &&
      !expirationDate
    ) {
      throw new BadRequestException(
        "expirationDate is required for this product"
      );
    }

    return {
      lotCode,
      expirationDate: expirationDate ?? undefined,
      locationId: this.normalizeOptional(input.locationId) ?? null,
      unitCost: this.normalizeUnitCost(input.unitCost),
    };
  }

  private async loadProductPolicy(
    tenantId: string,
    productId: string,
    client: PoolClient
  ) {
    const result = await client.query<ProductAdjustmentPolicyRow>(
      `
      SELECT id, cost, requires_lot, requires_expiration
      FROM products
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [productId, tenantId]
    );

    const policy = result.rows[0];
    if (!policy) {
      throw new BadRequestException("product not found for tenant");
    }
    return policy;
  }

  private productCost(policy: ProductAdjustmentPolicyRow) {
    return policy.cost == null ? 0 : Number(policy.cost);
  }

  private async applyLotIn(
    input: CreateStockAdjustmentInput,
    payload: AdjustmentLotPayload,
    policy: ProductAdjustmentPolicyRow,
    movement: StockMovementEntity,
    client: PoolClient
  ) {
    const branchId = input.branchId?.trim();
    if (!branchId) {
      throw new BadRequestException("branchId is required for lot adjustment");
    }

    const lot = await this.inventoryLotService.findOrCreateForAdjustmentIn(
      {
        tenantId: input.tenantId,
        branchId,
        productId: input.productId,
        lotCode: payload.lotCode,
        expirationDate: payload.expirationDate,
        receivedAt: movement.createdAt,
        unitCost: payload.unitCost ?? this.productCost(policy),
        requiresExpiration: policy.requires_expiration,
      },
      client
    );

    await this.inventoryLotBalanceService.incrementOnHand(
      input.tenantId,
      {
        branchId,
        productId: input.productId,
        lotId: lot.id,
        locationId: payload.locationId ?? null,
        quantity: movement.quantity,
        lastMovementAt: movement.createdAt,
      },
      client
    );

    await this.stockMovementLotService.createLink(
      {
        tenantId: input.tenantId,
        stockMovementId: movement.id,
        productId: input.productId,
        lotId: lot.id,
        locationId: payload.locationId ?? null,
        quantity: movement.quantity,
      },
      client
    );
  }

  private async applyLotOut(
    input: CreateStockAdjustmentInput,
    payload: AdjustmentLotPayload,
    movement: StockMovementEntity,
    client: PoolClient
  ) {
    const branchId = input.branchId?.trim();
    if (!branchId) {
      throw new BadRequestException("branchId is required for lot adjustment");
    }

    const lot = await this.inventoryLotService.findForAdjustmentOut(
      {
        tenantId: input.tenantId,
        branchId,
        productId: input.productId,
        lotCode: payload.lotCode,
        expirationDate: payload.expirationDate,
      },
      client
    );

    await this.inventoryLotBalanceService.decrementOnHand(
      input.tenantId,
      {
        branchId,
        productId: input.productId,
        lotId: lot.id,
        locationId: payload.locationId ?? null,
        quantity: movement.quantity,
        lastMovementAt: movement.createdAt,
      },
      client
    );

    await this.stockMovementLotService.createLink(
      {
        tenantId: input.tenantId,
        stockMovementId: movement.id,
        productId: input.productId,
        lotId: lot.id,
        locationId: payload.locationId ?? null,
        quantity: movement.quantity,
      },
      client
    );
  }

  async create(input: CreateStockAdjustmentInput) {
    if (input.type !== "IN" && input.type !== "OUT") {
      throw new BadRequestException("type must be IN or OUT");
    }
    const quantity = this.normalizeQuantity(input.quantity);

    const client = await this.db.getClient();
    let movement: StockMovementEntity | null = null;
    try {
      await client.query("BEGIN");

      const policy = await this.loadProductPolicy(
        input.tenantId,
        input.productId,
        client
      );
      const lotPayload = this.validateLotPayload(input, policy);

      movement = await this.stockMovementService.createMovement(
        {
          id: crypto.randomUUID(),
          tenantId: input.tenantId,
          productId: input.productId,
          type: input.type,
          quantity,
          referenceType: "ADJUSTMENT",
          referenceId: crypto.randomUUID(),
          branchId: input.branchId ?? null,
          terminalId: input.context?.terminalId ?? null,
          posSessionCode: input.context?.posSessionId ?? null,
          userId: input.context?.userId ?? null,
          referenceTable: "stock_adjustments",
          createdAt: new Date(),
        },
        client
      );

      if (lotPayload) {
        if (movement.type === "IN") {
          await this.applyLotIn(input, lotPayload, policy, movement, client);
        } else {
          await this.applyLotOut(input, lotPayload, movement, client);
        }
      }

      await client.query("COMMIT");
      this.stockMovementService.logMovementAuditEvent(movement);
      return movement;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
