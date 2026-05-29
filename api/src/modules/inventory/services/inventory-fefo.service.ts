import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { FinanceAccessRepository } from "../../finance/common/repositories/finance-access.repository";
import {
  InventoryFefoRepository,
  type InventoryFefoEligibleBalance,
} from "../repositories/inventory-fefo.repository";
import { canViewAllBranches } from "../utils/access";

export type InventoryFefoActor = {
  roles: string[];
  userId?: string;
  tenantId?: string;
  branchId?: string;
};

export type SelectLotsForConsumptionInput = {
  tenantId: string;
  branchId: string;
  productId: string;
  quantity: number;
  locationId?: string | null;
};

export type InventoryFefoSelection = {
  lotId: string;
  lotCode: string;
  expirationDate: Date | null;
  receivedAt: Date;
  locationId: string | null;
  quantityAvailable: number;
  quantityToConsume: number;
};

@Injectable()
export class InventoryFefoService {
  constructor(
    @Inject(InventoryFefoRepository)
    private readonly inventoryFefoRepository: InventoryFefoRepository,
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

  private normalizeQuantity(value: number) {
    const quantity = Number(value);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException("quantity must be greater than zero");
    }
    return quantity;
  }

  private toDateString(value: Date | null | undefined) {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private isExpired(balance: InventoryFefoEligibleBalance) {
    const expirationDate = this.toDateString(balance.expirationDate);
    return Boolean(
      expirationDate && expirationDate < new Date().toISOString().slice(0, 10)
    );
  }

  private sortFefo(
    balances: InventoryFefoEligibleBalance[]
  ): InventoryFefoEligibleBalance[] {
    return [...balances].sort((a, b) => {
      const expirationA = this.toDateString(a.expirationDate) ?? "9999-12-31";
      const expirationB = this.toDateString(b.expirationDate) ?? "9999-12-31";
      if (expirationA !== expirationB) {
        return expirationA.localeCompare(expirationB);
      }

      const receivedA = a.receivedAt.getTime();
      const receivedB = b.receivedAt.getTime();
      if (receivedA !== receivedB) {
        return receivedA - receivedB;
      }

      if (a.lotCode !== b.lotCode) {
        return a.lotCode.localeCompare(b.lotCode);
      }

      return a.lotId.localeCompare(b.lotId);
    });
  }

  private async assertBranchAccess(
    tenantId: string,
    branchId: string,
    actor?: InventoryFefoActor
  ) {
    const branchExists =
      await this.inventoryFefoRepository.validateBranchForTenant(
        tenantId,
        branchId
      );
    if (!branchExists) {
      throw new BadRequestException("branchId is invalid");
    }

    if (!actor || canViewAllBranches(actor)) {
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

  private async assertLocation(
    tenantId: string,
    branchId: string,
    locationId?: string | null
  ) {
    if (!locationId) {
      return;
    }

    const locationExists =
      await this.inventoryFefoRepository.validateLocationForTenantBranch(
        tenantId,
        branchId,
        locationId
      );
    if (!locationExists) {
      throw new BadRequestException("locationId is invalid");
    }
  }

  private filterEligible(
    balances: InventoryFefoEligibleBalance[],
    locationId?: string | null
  ) {
    return balances.filter((balance) => {
      if (balance.quantityAvailable <= 0) {
        return false;
      }
      if (["BLOCKED", "CANCELLED", "CONSUMED"].includes(balance.status)) {
        return false;
      }
      if (this.isExpired(balance)) {
        return false;
      }
      if (locationId && balance.locationId !== locationId) {
        return false;
      }
      return true;
    });
  }

  async selectLotsForConsumption(
    input: SelectLotsForConsumptionInput,
    actor?: InventoryFefoActor
  ) {
    const tenantId = this.normalizeRequired(input.tenantId, "tenantId");
    const branchId = this.normalizeRequired(input.branchId, "branchId");
    const productId = this.normalizeRequired(input.productId, "productId");
    const locationId = this.normalizeOptionalId(input.locationId) ?? null;
    const requestedQuantity = this.normalizeQuantity(input.quantity);

    const product =
      await this.inventoryFefoRepository.validateProductForTenant(
        tenantId,
        productId
      );
    if (!product) {
      throw new BadRequestException("productId is invalid");
    }
    if (!product.requiresLot) {
      throw new BadRequestException(
        "FEFO applies only to products with lot control"
      );
    }

    await this.assertBranchAccess(tenantId, branchId, actor);
    await this.assertLocation(tenantId, branchId, locationId);

    const rawBalances = await this.inventoryFefoRepository.findEligibleBalances(
      tenantId,
      branchId,
      productId,
      locationId
    );
    const eligibleBalances = this.filterEligible(rawBalances, locationId);

    if (
      product.requiresExpiration &&
      eligibleBalances.some((balance) => !balance.expirationDate)
    ) {
      throw new BadRequestException(
        "FEFO inconsistency: expirationDate is required for this product"
      );
    }

    let remainingQuantity = requestedQuantity;
    const selections: InventoryFefoSelection[] = [];

    for (const balance of this.sortFefo(eligibleBalances)) {
      if (remainingQuantity <= 0) {
        break;
      }

      const quantityToConsume = Math.min(
        balance.quantityAvailable,
        remainingQuantity
      );
      if (quantityToConsume <= 0) {
        continue;
      }

      selections.push({
        lotId: balance.lotId,
        lotCode: balance.lotCode,
        expirationDate: balance.expirationDate,
        receivedAt: balance.receivedAt,
        locationId: balance.locationId,
        quantityAvailable: balance.quantityAvailable,
        quantityToConsume,
      });
      remainingQuantity -= quantityToConsume;
    }

    const selectedQuantity = selections.reduce(
      (sum, selection) => sum + selection.quantityToConsume,
      0
    );
    const missingQuantity = Math.max(0, requestedQuantity - selectedQuantity);

    return {
      canFulfill: missingQuantity === 0,
      requestedQuantity,
      selectedQuantity,
      missingQuantity,
      selections,
      warnings: [],
    };
  }
}
