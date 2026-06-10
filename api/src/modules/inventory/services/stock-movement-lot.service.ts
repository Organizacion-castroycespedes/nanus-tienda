import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import crypto from "crypto";
import type { PoolClient } from "pg";
import { FinanceAccessRepository } from "../../finance/common/repositories/finance-access.repository";
import { StockMovementLotEntity } from "../entities/stock-movement-lot.entity";
import { StockMovementLotRepository } from "../repositories/stock-movement-lot.repository";
import { canViewAllBranches } from "../utils/access";

type StockMovementLotActor = {
  roles: string[];
  userId?: string;
  tenantId?: string;
  branchId?: string;
};

type CreateStockMovementLotInput = {
  tenantId: string;
  stockMovementId: string;
  productId: string;
  lotId?: string | null;
  locationId?: string | null;
  quantity: number;
};

@Injectable()
export class StockMovementLotService {
  constructor(
    @Inject(StockMovementLotRepository)
    private readonly stockMovementLotRepository: StockMovementLotRepository,
    @Inject(FinanceAccessRepository)
    private readonly financeAccessRepository: FinanceAccessRepository
  ) {}

  private normalizeRequired(value: string | undefined, field: string) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(`${field} is required`);
    }
    return normalized;
  }

  private normalizeOptionalId(value: string | null | undefined) {
    if (value === null) {
      return null;
    }
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private assertPositive(value: number, field: string) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException(`${field} must be greater than zero`);
    }
  }

  private async assertBranchAccess(
    tenantId: string,
    branchId: string | null,
    actor: StockMovementLotActor
  ) {
    if (!branchId || canViewAllBranches(actor)) {
      return;
    }

    if (actor.branchId === branchId && !actor.userId) {
      return;
    }

    if (!actor.userId) {
      throw new ForbiddenException("user is required");
    }

    const branchIds =
      await this.financeAccessRepository.findAccessibleBranchIds(
        actor.userId,
        tenantId
      );

    if (branchIds.includes(branchId)) {
      return;
    }

    if (branchIds.length === 0 && actor.branchId === branchId) {
      return;
    }

    throw new ForbiddenException("not authorized for this branch");
  }

  private async getStockMovement(
    tenantId: string,
    stockMovementId: string,
    client?: PoolClient
  ) {
    const movement =
      await this.stockMovementLotRepository.validateStockMovementBelongsToTenant(
        tenantId,
        stockMovementId,
        client
      );

    if (!movement) {
      throw new BadRequestException("stockMovementId is invalid");
    }
    return movement;
  }

  async findByMovement(
    tenantId: string,
    stockMovementId: string,
    actor: StockMovementLotActor
  ) {
    const movement = await this.getStockMovement(tenantId, stockMovementId);
    await this.assertBranchAccess(tenantId, movement.branch_id, actor);
    return this.stockMovementLotRepository.findByMovement(
      tenantId,
      stockMovementId
    );
  }

  async findByLot(
    tenantId: string,
    lotId: string,
    actor: StockMovementLotActor
  ) {
    const lot = await this.stockMovementLotRepository.validateLotBelongsToTenant(
      tenantId,
      lotId
    );
    if (!lot) {
      throw new BadRequestException("lotId is invalid");
    }

    await this.assertBranchAccess(tenantId, lot.branch_id, actor);
    return this.stockMovementLotRepository.findByLot(tenantId, lotId);
  }

  async createLink(input: CreateStockMovementLotInput, client?: PoolClient) {
    const stockMovementId = this.normalizeRequired(
      input.stockMovementId,
      "stockMovementId"
    );
    const productId = this.normalizeRequired(input.productId, "productId");
    const lotId = this.normalizeOptionalId(input.lotId);
    const locationId = this.normalizeOptionalId(input.locationId);
    this.assertPositive(input.quantity, "quantity");

    const movement = await this.getStockMovement(
      input.tenantId,
      stockMovementId,
      client
    );
    if (movement.product_id !== productId) {
      throw new BadRequestException(
        "productId does not match stock movement"
      );
    }

    if (lotId) {
      const lot = await this.stockMovementLotRepository.validateLotBelongsToTenant(
        input.tenantId,
        lotId,
        client
      );
      if (!lot) {
        throw new BadRequestException("lotId is invalid");
      }
      if (lot.product_id !== productId) {
        throw new BadRequestException("lotId does not match productId");
      }
    }

    if (locationId) {
      const location =
        await this.stockMovementLotRepository.validateLocationBelongsToTenant(
          input.tenantId,
          locationId,
          client
        );
      if (!location) {
        throw new BadRequestException("locationId is invalid");
      }
    }

    const link = StockMovementLotEntity.create({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      stockMovementId,
      productId,
      lotId,
      locationId,
      quantity: input.quantity,
      createdAt: new Date(),
    });

    return this.stockMovementLotRepository.create(
      {
        id: link.id,
        tenantId: link.tenantId,
        stockMovementId: link.stockMovementId,
        productId: link.productId,
        lotId: link.lotId,
        locationId: link.locationId,
        quantity: link.quantity,
        createdAt: link.createdAt,
      },
      client
    );
  }
}
