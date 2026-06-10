import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import type { PoolClient } from "pg";
import { FinanceAccessRepository } from "../../finance/common/repositories/finance-access.repository";
import {
  InventoryLotBalanceEntity,
  type InventoryLotBalanceProps,
} from "../entities/inventory-lot-balance.entity";
import {
  InventoryLotBalanceRepository,
  type InventoryLotBalanceFilters,
} from "../repositories/inventory-lot-balance.repository";
import { canViewAllBranches } from "../utils/access";

type InventoryLotBalanceActor = {
  roles: string[];
  userId?: string;
  tenantId?: string;
  branchId?: string;
};

type ListInventoryLotBalancesInput = {
  branchId?: string;
  productId?: string;
  lotId?: string;
  locationId?: string | null;
  onlyAvailable?: boolean;
  onlyActiveLots?: boolean;
  expirationFrom?: string | Date;
  expirationTo?: string | Date;
};

type CreateInventoryLotBalanceInput = {
  tenantId: string;
  branchId: string;
  productId: string;
  lotId: string;
  locationId?: string | null;
  quantityOnHand?: number;
  quantityReserved?: number;
  lastMovementAt?: Date | null;
};

type QuantityUpdateInput = {
  quantityOnHand?: number;
  quantityReserved?: number;
  lastMovementAt?: Date | null;
};

type QuantityOperationInput = {
  branchId: string;
  productId: string;
  lotId: string;
  locationId?: string | null;
  quantity: number;
  lastMovementAt?: Date | null;
};

@Injectable()
export class InventoryLotBalanceService {
  constructor(
    @Inject(InventoryLotBalanceRepository)
    private readonly inventoryLotBalanceRepository: InventoryLotBalanceRepository,
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

  private assertNonNegative(value: number, field: string) {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${field} must be non-negative`);
    }
  }

  private assertPositive(value: number, field: string) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException(`${field} must be greater than zero`);
    }
  }

  private parseDateOnly(value: string | Date | undefined, field: string) {
    if (value === undefined) {
      return undefined;
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new BadRequestException(`${field} is invalid`);
      }
      return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
    }

    const normalized = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    }

    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== normalized
    ) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return parsed;
  }

  private async assertBranchAccess(
    tenantId: string,
    branchId: string,
    actor: InventoryLotBalanceActor
  ) {
    const branch = await this.financeAccessRepository.findBranchById(
      branchId,
      tenantId
    );
    if (!branch) {
      throw new BadRequestException("branchId is invalid");
    }

    if (canViewAllBranches(actor)) {
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

  private async assertLotShape(
    tenantId: string,
    branchId: string,
    productId: string,
    lotId: string,
    client?: PoolClient
  ) {
    const lot = await this.inventoryLotBalanceRepository.validateLotBelongsToTenant(
      tenantId,
      lotId,
      client
    );
    if (!lot) {
      throw new BadRequestException("lotId is invalid");
    }
    if (lot.branch_id !== branchId) {
      throw new BadRequestException("branchId does not match lot");
    }
    if (lot.product_id !== productId) {
      throw new BadRequestException("productId does not match lot");
    }
    return lot;
  }

  private async assertLocationShape(
    tenantId: string,
    branchId: string,
    locationId?: string | null,
    client?: PoolClient
  ) {
    if (!locationId) {
      return;
    }

    const location =
      await this.inventoryLotBalanceRepository.validateLocationBelongsToTenantBranch(
        tenantId,
        branchId,
        locationId,
        client
      );

    if (!location) {
      throw new BadRequestException("locationId is invalid");
    }
  }

  private assertQuantities(quantityOnHand: number, quantityReserved: number) {
    this.assertNonNegative(quantityOnHand, "quantityOnHand");
    this.assertNonNegative(quantityReserved, "quantityReserved");
    if (quantityReserved > quantityOnHand) {
      throw new BadRequestException(
        "quantityReserved cannot exceed quantityOnHand"
      );
    }
  }

  private assertBalanceFound(balance: InventoryLotBalanceEntity | null) {
    if (!balance) {
      throw new NotFoundException("inventory lot balance not found");
    }
    return balance;
  }

  private resolveListBranchId(
    actor: InventoryLotBalanceActor,
    branchId?: string
  ) {
    const normalizedBranchId = branchId?.trim();

    if (canViewAllBranches(actor)) {
      return normalizedBranchId;
    }

    return normalizedBranchId ?? actor.branchId;
  }

  async findMany(
    tenantId: string,
    filters: ListInventoryLotBalancesInput,
    actor: InventoryLotBalanceActor
  ) {
    const branchId = this.resolveListBranchId(actor, filters.branchId);
    const expirationFrom = this.parseDateOnly(
      filters.expirationFrom,
      "expirationFrom"
    );
    const expirationTo = this.parseDateOnly(
      filters.expirationTo,
      "expirationTo"
    );

    if (branchId) {
      await this.assertBranchAccess(tenantId, branchId, actor);
    } else if (!canViewAllBranches(actor)) {
      throw new BadRequestException("branchId is required");
    }

    if (expirationFrom && expirationTo && expirationFrom > expirationTo) {
      throw new BadRequestException(
        "expirationFrom cannot be greater than expirationTo"
      );
    }

    return this.inventoryLotBalanceRepository.findMany(tenantId, {
      branchId,
      productId: filters.productId,
      lotId: filters.lotId,
      locationId:
        filters.locationId === undefined
          ? undefined
          : this.normalizeOptionalId(filters.locationId) ?? null,
      onlyAvailable: filters.onlyAvailable,
      onlyActiveLots: filters.onlyActiveLots,
      expirationFrom,
      expirationTo,
    } satisfies InventoryLotBalanceFilters);
  }

  async findById(
    tenantId: string,
    balanceId: string,
    actor: InventoryLotBalanceActor
  ) {
    const balance = this.assertBalanceFound(
      await this.inventoryLotBalanceRepository.findById(tenantId, balanceId)
    );
    await this.assertBranchAccess(tenantId, balance.branchId, actor);
    return balance;
  }

  async createBalance(input: CreateInventoryLotBalanceInput, client?: PoolClient) {
    const branchId = this.normalizeRequired(input.branchId, "branchId");
    const productId = this.normalizeRequired(input.productId, "productId");
    const lotId = this.normalizeRequired(input.lotId, "lotId");
    const locationId = this.normalizeOptionalId(input.locationId);
    const quantityOnHand = input.quantityOnHand ?? 0;
    const quantityReserved = input.quantityReserved ?? 0;

    await this.assertLotShape(input.tenantId, branchId, productId, lotId, client);
    await this.assertLocationShape(
      input.tenantId,
      branchId,
      locationId,
      client
    );
    this.assertQuantities(quantityOnHand, quantityReserved);

    const now = new Date();
    const balance = InventoryLotBalanceEntity.create({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      branchId,
      productId,
      lotId,
      locationId,
      quantityOnHand,
      quantityReserved,
      lastMovementAt: input.lastMovementAt ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return this.inventoryLotBalanceRepository.create({
      id: balance.id,
      tenantId: balance.tenantId,
      branchId: balance.branchId,
      productId: balance.productId,
      lotId: balance.lotId,
      locationId: balance.locationId,
      quantityOnHand: balance.quantityOnHand,
      quantityReserved: balance.quantityReserved,
      lastMovementAt: balance.lastMovementAt,
      createdAt: balance.createdAt,
      updatedAt: balance.updatedAt,
    } satisfies Omit<InventoryLotBalanceProps, "quantityAvailable">, client);
  }

  async updateQuantities(
    tenantId: string,
    balanceId: string,
    quantities: QuantityUpdateInput,
    client?: PoolClient
  ) {
    const current = this.assertBalanceFound(
      await this.inventoryLotBalanceRepository.findById(
        tenantId,
        balanceId,
        client
      )
    );
    const quantityOnHand =
      quantities.quantityOnHand ?? current.quantityOnHand;
    const quantityReserved =
      quantities.quantityReserved ?? current.quantityReserved;

    this.assertQuantities(quantityOnHand, quantityReserved);

    const updated = await this.inventoryLotBalanceRepository.updateQuantities(
      tenantId,
      balanceId,
      {
        quantityOnHand: quantities.quantityOnHand,
        quantityReserved: quantities.quantityReserved,
        lastMovementAt: quantities.lastMovementAt,
      },
      client
    );
    return this.assertBalanceFound(updated);
  }

  async incrementOnHand(
    tenantId: string,
    input: QuantityOperationInput,
    client?: PoolClient
  ) {
    this.assertPositive(input.quantity, "quantity");
    await this.assertLotShape(
      tenantId,
      input.branchId,
      input.productId,
      input.lotId,
      client
    );
    await this.assertLocationShape(
      tenantId,
      input.branchId,
      input.locationId,
      client
    );

    const existing = await this.inventoryLotBalanceRepository.findByLotLocation(
      tenantId,
      input.branchId,
      input.productId,
      input.lotId,
      input.locationId,
      client
    );

    if (!existing) {
      return this.createBalance({
        tenantId,
        branchId: input.branchId,
        productId: input.productId,
        lotId: input.lotId,
        locationId: input.locationId,
        quantityOnHand: input.quantity,
        quantityReserved: 0,
        lastMovementAt: input.lastMovementAt ?? new Date(),
      }, client);
    }

    const updated = await this.inventoryLotBalanceRepository.incrementOnHand(
      tenantId,
      input,
      client
    );
    return this.assertBalanceFound(updated);
  }

  async decrementOnHand(
    tenantId: string,
    input: QuantityOperationInput,
    client?: PoolClient
  ) {
    this.assertPositive(input.quantity, "quantity");
    const current = this.assertBalanceFound(
      await this.inventoryLotBalanceRepository.findByLotLocation(
        tenantId,
        input.branchId,
        input.productId,
        input.lotId,
        input.locationId,
        client
      )
    );

    if (input.quantity > current.quantityAvailable) {
      throw new BadRequestException("quantity exceeds available stock");
    }

    const updated = await this.inventoryLotBalanceRepository.decrementOnHand(
      tenantId,
      input,
      client
    );
    return this.assertBalanceFound(updated);
  }

  async reserve(
    tenantId: string,
    input: QuantityOperationInput,
    client?: PoolClient
  ) {
    this.assertPositive(input.quantity, "quantity");
    const current = this.assertBalanceFound(
      await this.inventoryLotBalanceRepository.findByLotLocation(
        tenantId,
        input.branchId,
        input.productId,
        input.lotId,
        input.locationId,
        client
      )
    );

    if (input.quantity > current.quantityAvailable) {
      throw new BadRequestException("quantity exceeds available stock");
    }

    const updated = await this.inventoryLotBalanceRepository.reserve(
      tenantId,
      input,
      client
    );
    return this.assertBalanceFound(updated);
  }

  async releaseReservation(
    tenantId: string,
    input: QuantityOperationInput,
    client?: PoolClient
  ) {
    this.assertPositive(input.quantity, "quantity");
    const current = this.assertBalanceFound(
      await this.inventoryLotBalanceRepository.findByLotLocation(
        tenantId,
        input.branchId,
        input.productId,
        input.lotId,
        input.locationId,
        client
      )
    );

    if (input.quantity > current.quantityReserved) {
      throw new BadRequestException("quantity exceeds reserved stock");
    }

    const updated = await this.inventoryLotBalanceRepository.releaseReservation(
      tenantId,
      input,
      client
    );
    return this.assertBalanceFound(updated);
  }
}
