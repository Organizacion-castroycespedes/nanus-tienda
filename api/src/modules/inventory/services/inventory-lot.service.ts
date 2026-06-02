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
  INVENTORY_LOT_STATUSES,
  InventoryLotEntity,
  type InventoryLotStatus,
} from "../entities/inventory-lot.entity";
import {
  InventoryLotRepository,
  type InventoryLotFilters,
} from "../repositories/inventory-lot.repository";
import { canViewAllBranches } from "../utils/access";

type InventoryLotActor = {
  roles: string[];
  userId?: string;
  tenantId?: string;
  branchId?: string;
};

type ListInventoryLotsInput = {
  branchId?: string;
  productId?: string;
  supplierId?: string;
  status?: InventoryLotStatus;
  isLegacy?: boolean;
  expirationFrom?: string | Date;
  expirationTo?: string | Date;
  search?: string;
};

type CreateInventoryLotInput = {
  tenantId: string;
  branchId: string;
  productId: string;
  supplierId?: string | null;
  purchaseId?: string | null;
  purchaseItemId?: string | null;
  lotCode: string;
  expirationDate?: string | Date | null;
  receivedAt?: string | Date;
  unitCost?: number;
  status?: InventoryLotStatus;
  isLegacy?: boolean;
};

type FindOrCreatePurchaseLotInput = {
  tenantId: string;
  branchId: string;
  productId: string;
  supplierId?: string | null;
  purchaseId?: string | null;
  purchaseItemId?: string | null;
  lotCode: string;
  expirationDate?: string | Date | null;
  receivedAt?: string | Date;
  unitCost?: number;
  requiresExpiration: boolean;
};

type FindOrCreateAdjustmentInLotInput = {
  tenantId: string;
  branchId: string;
  productId: string;
  lotCode: string;
  expirationDate?: string | Date | null;
  receivedAt?: string | Date;
  unitCost?: number;
  requiresExpiration: boolean;
};

type FindAdjustmentOutLotInput = {
  tenantId: string;
  branchId: string;
  productId: string;
  lotCode: string;
  expirationDate?: string | Date | null;
};

type UpdateInventoryLotInput = {
  tenantId: string;
  lotId: string;
  supplierId?: string | null;
  purchaseId?: string | null;
  purchaseItemId?: string | null;
  lotCode?: string;
  expirationDate?: string | Date | null;
  receivedAt?: string | Date;
  unitCost?: number;
  status?: InventoryLotStatus;
  isLegacy?: boolean;
  branchId?: string;
  productId?: string;
};

type InventoryLotPayload = {
  supplierId?: string | null;
  purchaseId?: string | null;
  purchaseItemId?: string | null;
  lotCode: string;
  expirationDate: Date | null;
  receivedAt: Date;
  unitCost: number;
  status: InventoryLotStatus;
  isLegacy: boolean;
};

@Injectable()
export class InventoryLotService {
  constructor(
    @Inject(InventoryLotRepository)
    private readonly inventoryLotRepository: InventoryLotRepository,
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

  private normalizeLotCode(lotCode: string | undefined) {
    return this.normalizeRequired(lotCode, "lotCode").toUpperCase();
  }

  private normalizeOptionalId(value: string | null | undefined) {
    if (value === null) {
      return null;
    }
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private normalizeStatus(status: InventoryLotStatus | undefined) {
    const normalized = status ?? "ACTIVE";
    if (!INVENTORY_LOT_STATUSES.includes(normalized)) {
      throw new BadRequestException("status is invalid");
    }
    return normalized;
  }

  private assertOptionalBoolean(value: boolean | undefined, field: string) {
    if (value === undefined) {
      return;
    }
    if (typeof value !== "boolean") {
      throw new BadRequestException(`${field} must be a boolean`);
    }
  }

  private normalizeUnitCost(unitCost: number | undefined) {
    const normalized = unitCost ?? 0;
    if (!Number.isFinite(normalized) || normalized < 0) {
      throw new BadRequestException("unitCost must be non-negative");
    }
    return normalized;
  }

  private parseDateOnly(
    value: string | Date | null | undefined,
    field: string
  ): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
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
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} is invalid`);
    }
    if (parsed.toISOString().slice(0, 10) !== normalized) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return parsed;
  }

  private parseDateTime(
    value: string | Date | undefined,
    field: string
  ): Date | undefined {
    if (value === undefined) {
      return undefined;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return parsed;
  }

  private toDateString(value: Date | null | undefined) {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private todayString() {
    return new Date().toISOString().slice(0, 10);
  }

  private assertExpirationFloor(expirationDate: Date | null | undefined) {
    const dateString = this.toDateString(expirationDate);
    if (dateString && dateString < "2000-01-01") {
      throw new BadRequestException(
        "expirationDate cannot be before 2000-01-01"
      );
    }
  }

  private assertActiveLotIsNotExpired(
    status: InventoryLotStatus,
    expirationDate: Date | null
  ) {
    const dateString = this.toDateString(expirationDate);
    if (status === "ACTIVE" && dateString && dateString < this.todayString()) {
      throw new BadRequestException("ACTIVE lot cannot be expired");
    }
  }

  private async assertBranchBelongsToTenant(tenantId: string, branchId: string) {
    const branchExists =
      await this.inventoryLotRepository.validateBranchBelongsToTenant(
        tenantId,
        branchId
      );
    if (!branchExists) {
      throw new BadRequestException("branchId is invalid");
    }
  }

  private async assertBranchAccess(
    tenantId: string,
    branchId: string,
    actor: InventoryLotActor
  ) {
    await this.assertBranchBelongsToTenant(tenantId, branchId);

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

  private async assertProductBelongsToTenant(
    tenantId: string,
    productId: string
  ) {
    const productExists =
      await this.inventoryLotRepository.validateProductBelongsToTenant(
        tenantId,
        productId
      );
    if (!productExists) {
      throw new BadRequestException("productId is invalid");
    }
  }

  private async getProductLotPolicy(tenantId: string, productId: string) {
    const product = await this.inventoryLotRepository.findProductLotPolicy(
      tenantId,
      productId
    );
    if (!product) {
      throw new BadRequestException("productId is invalid");
    }
    return product;
  }

  private async assertOptionalRelations(
    tenantId: string,
    data: {
      supplierId?: string | null;
      purchaseId?: string | null;
      purchaseItemId?: string | null;
    }
  ) {
    if (
      data.supplierId &&
      !(await this.inventoryLotRepository.validateSupplierBelongsToTenant(
        tenantId,
        data.supplierId
      ))
    ) {
      throw new BadRequestException("supplierId is invalid");
    }

    if (
      data.purchaseId &&
      !(await this.inventoryLotRepository.validatePurchaseBelongsToTenant(
        tenantId,
        data.purchaseId
      ))
    ) {
      throw new BadRequestException("purchaseId is invalid");
    }

    if (
      data.purchaseItemId &&
      !(await this.inventoryLotRepository.validatePurchaseItemBelongsToTenant(
        tenantId,
        data.purchaseItemId
      ))
    ) {
      throw new BadRequestException("purchaseItemId is invalid");
    }
  }

  private async assertLotCodeUnique(
    tenantId: string,
    branchId: string,
    productId: string,
    lotCode: string,
    excludeLotId?: string
  ) {
    const existing = await this.inventoryLotRepository.findByCode(
      tenantId,
      branchId,
      productId,
      lotCode
    );

    if (existing && existing.id !== excludeLotId) {
      throw new BadRequestException("lotCode already exists for this product");
    }
  }

  private assertExistingLotCanReceive(
    lot: InventoryLotEntity,
    expirationDate: Date | null,
    requiresExpiration: boolean
  ) {
    if (lot.status === "BLOCKED" || lot.status === "CANCELLED") {
      throw new BadRequestException("inventory lot cannot receive stock");
    }

    if (requiresExpiration && !expirationDate && !lot.expirationDate) {
      throw new BadRequestException(
        "expirationDate is required for this product"
      );
    }

    const currentExpiration = this.toDateString(lot.expirationDate);
    const requestedExpiration = this.toDateString(expirationDate);
    if (currentExpiration && requestedExpiration && currentExpiration !== requestedExpiration) {
      throw new BadRequestException(
        "expirationDate does not match existing lot"
      );
    }
    if (!currentExpiration && requestedExpiration) {
      throw new BadRequestException(
        "expirationDate does not match existing lot"
      );
    }
  }

  private assertExistingLotCanAdjustOut(lot: InventoryLotEntity) {
    if (
      lot.status === "BLOCKED" ||
      lot.status === "CANCELLED" ||
      lot.status === "CONSUMED"
    ) {
      throw new BadRequestException("inventory lot cannot be adjusted out");
    }
  }

  private assertExpirationMatchesExistingLot(
    lot: InventoryLotEntity,
    expirationDate: Date | null
  ) {
    const currentExpiration = this.toDateString(lot.expirationDate);
    const requestedExpiration = this.toDateString(expirationDate);
    if (!requestedExpiration) {
      return;
    }
    if (currentExpiration !== requestedExpiration) {
      throw new BadRequestException(
        "expirationDate does not match existing lot"
      );
    }
  }

  private assertExpirationRequirement(
    requiresExpiration: boolean,
    expirationDate: Date | null
  ) {
    if (requiresExpiration && !expirationDate) {
      throw new BadRequestException(
        "expirationDate is required for this product"
      );
    }
  }

  private assertStatusTransition(
    current: InventoryLotEntity,
    nextStatus: InventoryLotStatus
  ) {
    if (current.status === "CANCELLED" && nextStatus === "ACTIVE") {
      throw new BadRequestException("CANCELLED lot cannot return to ACTIVE");
    }
    if (current.status === "CONSUMED" && nextStatus === "CANCELLED") {
      throw new BadRequestException("CONSUMED lot cannot be cancelled");
    }
  }

  private assertLotFound(lot: InventoryLotEntity | null) {
    if (!lot) {
      throw new NotFoundException("inventory lot not found");
    }
    return lot;
  }

  private buildCreatePayload(input: CreateInventoryLotInput) {
    this.assertOptionalBoolean(input.isLegacy, "isLegacy");
    const expirationDate =
      this.parseDateOnly(input.expirationDate, "expirationDate") ?? null;
    const receivedAt =
      this.parseDateTime(input.receivedAt, "receivedAt") ?? new Date();

    return {
      supplierId: this.normalizeOptionalId(input.supplierId),
      purchaseId: this.normalizeOptionalId(input.purchaseId),
      purchaseItemId: this.normalizeOptionalId(input.purchaseItemId),
      lotCode: this.normalizeLotCode(input.lotCode),
      expirationDate,
      receivedAt,
      unitCost: this.normalizeUnitCost(input.unitCost),
      status: this.normalizeStatus(input.status),
      isLegacy: input.isLegacy ?? false,
    } satisfies InventoryLotPayload;
  }

  private buildUpdatePayload(input: UpdateInventoryLotInput) {
    this.assertOptionalBoolean(input.isLegacy, "isLegacy");

    if (input.branchId !== undefined) {
      throw new BadRequestException("branchId cannot be updated");
    }
    if (input.productId !== undefined) {
      throw new BadRequestException("productId cannot be updated");
    }

    return {
      supplierId:
        input.supplierId !== undefined
          ? this.normalizeOptionalId(input.supplierId)
          : undefined,
      purchaseId:
        input.purchaseId !== undefined
          ? this.normalizeOptionalId(input.purchaseId)
          : undefined,
      purchaseItemId:
        input.purchaseItemId !== undefined
          ? this.normalizeOptionalId(input.purchaseItemId)
          : undefined,
      lotCode:
        input.lotCode !== undefined
          ? this.normalizeLotCode(input.lotCode)
          : undefined,
      expirationDate:
        input.expirationDate !== undefined
          ? this.parseDateOnly(input.expirationDate, "expirationDate")
          : undefined,
      receivedAt:
        input.receivedAt !== undefined
          ? this.parseDateTime(input.receivedAt, "receivedAt")
          : undefined,
      unitCost:
        input.unitCost !== undefined
          ? this.normalizeUnitCost(input.unitCost)
          : undefined,
      status:
        input.status !== undefined
          ? this.normalizeStatus(input.status)
          : undefined,
      isLegacy: input.isLegacy,
    };
  }

  private resolveListBranchId(actor: InventoryLotActor, branchId?: string) {
    const normalizedBranchId = branchId?.trim();

    if (canViewAllBranches(actor)) {
      return normalizedBranchId;
    }

    return normalizedBranchId ?? actor.branchId;
  }

  async findMany(
    tenantId: string,
    filters: ListInventoryLotsInput,
    actor: InventoryLotActor
  ) {
    const branchId = this.resolveListBranchId(actor, filters.branchId);
    const status =
      filters.status !== undefined
        ? this.normalizeStatus(filters.status)
        : undefined;
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

    if (filters.productId) {
      await this.assertProductBelongsToTenant(tenantId, filters.productId);
    }

    if (
      filters.supplierId &&
      !(await this.inventoryLotRepository.validateSupplierBelongsToTenant(
        tenantId,
        filters.supplierId
      ))
    ) {
      throw new BadRequestException("supplierId is invalid");
    }

    if (expirationFrom && expirationTo && expirationFrom > expirationTo) {
      throw new BadRequestException(
        "expirationFrom cannot be greater than expirationTo"
      );
    }

    return this.inventoryLotRepository.findMany(tenantId, {
      branchId,
      productId: filters.productId,
      supplierId: filters.supplierId,
      status,
      isLegacy: filters.isLegacy,
      expirationFrom: expirationFrom ?? undefined,
      expirationTo: expirationTo ?? undefined,
      search: filters.search?.trim(),
    } satisfies InventoryLotFilters);
  }

  async findById(tenantId: string, lotId: string, actor: InventoryLotActor) {
    const lot = this.assertLotFound(
      await this.inventoryLotRepository.findById(tenantId, lotId)
    );
    await this.assertBranchAccess(tenantId, lot.branchId, actor);
    return lot;
  }

  async create(input: CreateInventoryLotInput, actor: InventoryLotActor) {
    const branchId = this.normalizeRequired(input.branchId, "branchId");
    const productId = this.normalizeRequired(input.productId, "productId");
    const payload = this.buildCreatePayload(input);

    await this.assertBranchAccess(input.tenantId, branchId, actor);
    const productPolicy = await this.getProductLotPolicy(
      input.tenantId,
      productId
    );
    await this.assertOptionalRelations(input.tenantId, payload);
    await this.assertLotCodeUnique(
      input.tenantId,
      branchId,
      productId,
      payload.lotCode
    );

    this.assertExpirationFloor(payload.expirationDate);
    this.assertExpirationRequirement(
      productPolicy.requires_expiration,
      payload.expirationDate
    );
    this.assertActiveLotIsNotExpired(payload.status, payload.expirationDate);

    const now = new Date();
    const lot = InventoryLotEntity.create({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      branchId,
      productId,
      supplierId: payload.supplierId,
      purchaseId: payload.purchaseId,
      purchaseItemId: payload.purchaseItemId,
      lotCode: payload.lotCode,
      expirationDate: payload.expirationDate,
      receivedAt: payload.receivedAt,
      unitCost: payload.unitCost,
      status: payload.status,
      isLegacy: payload.isLegacy,
      createdAt: now,
      updatedAt: now,
    });

    return this.inventoryLotRepository.create({
      id: lot.id,
      tenantId: lot.tenantId,
      branchId: lot.branchId,
      productId: lot.productId,
      supplierId: lot.supplierId,
      purchaseId: lot.purchaseId,
      purchaseItemId: lot.purchaseItemId,
      lotCode: lot.lotCode,
      expirationDate: lot.expirationDate,
      receivedAt: lot.receivedAt,
      unitCost: lot.unitCost,
      status: lot.status,
      isLegacy: lot.isLegacy,
      createdAt: lot.createdAt,
      updatedAt: lot.updatedAt,
    });
  }

  async findOrCreateForPurchase(
    input: FindOrCreatePurchaseLotInput,
    client?: PoolClient
  ) {
    const branchId = this.normalizeRequired(input.branchId, "branchId");
    const productId = this.normalizeRequired(input.productId, "productId");
    const lotCode = this.normalizeLotCode(input.lotCode);
    const expirationDate =
      this.parseDateOnly(input.expirationDate, "expirationDate") ?? null;
    const receivedAt =
      this.parseDateTime(input.receivedAt, "receivedAt") ?? new Date();
    const unitCost = this.normalizeUnitCost(input.unitCost);

    const existing = await this.inventoryLotRepository.findByCode(
      input.tenantId,
      branchId,
      productId,
      lotCode,
      client
    );
    if (existing) {
      this.assertExpirationFloor(expirationDate);
      this.assertActiveLotIsNotExpired(
        "ACTIVE",
        expirationDate ?? existing.expirationDate
      );
      this.assertExistingLotCanReceive(
        existing,
        expirationDate,
        input.requiresExpiration
      );
      return existing;
    }

    this.assertExpirationFloor(expirationDate);
    this.assertExpirationRequirement(input.requiresExpiration, expirationDate);
    this.assertActiveLotIsNotExpired("ACTIVE", expirationDate);

    const now = new Date();
    const lot = InventoryLotEntity.create({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      branchId,
      productId,
      supplierId: this.normalizeOptionalId(input.supplierId),
      purchaseId: this.normalizeOptionalId(input.purchaseId),
      purchaseItemId: this.normalizeOptionalId(input.purchaseItemId),
      lotCode,
      expirationDate,
      receivedAt,
      unitCost,
      status: "ACTIVE",
      isLegacy: false,
      createdAt: now,
      updatedAt: now,
    });

    return this.inventoryLotRepository.create(
      {
        id: lot.id,
        tenantId: lot.tenantId,
        branchId: lot.branchId,
        productId: lot.productId,
        supplierId: lot.supplierId,
        purchaseId: lot.purchaseId,
        purchaseItemId: lot.purchaseItemId,
        lotCode: lot.lotCode,
        expirationDate: lot.expirationDate,
        receivedAt: lot.receivedAt,
        unitCost: lot.unitCost,
        status: lot.status,
        isLegacy: lot.isLegacy,
        createdAt: lot.createdAt,
        updatedAt: lot.updatedAt,
      },
      client
    );
  }

  async findOrCreateForAdjustmentIn(
    input: FindOrCreateAdjustmentInLotInput,
    client?: PoolClient
  ) {
    const branchId = this.normalizeRequired(input.branchId, "branchId");
    const productId = this.normalizeRequired(input.productId, "productId");
    const lotCode = this.normalizeLotCode(input.lotCode);
    const expirationDate =
      this.parseDateOnly(input.expirationDate, "expirationDate") ?? null;
    const receivedAt =
      this.parseDateTime(input.receivedAt, "receivedAt") ?? new Date();
    const unitCost = this.normalizeUnitCost(input.unitCost);

    this.assertExpirationFloor(expirationDate);
    this.assertExpirationRequirement(input.requiresExpiration, expirationDate);

    const existing = await this.inventoryLotRepository.findByCode(
      input.tenantId,
      branchId,
      productId,
      lotCode,
      client
    );
    if (existing) {
      this.assertActiveLotIsNotExpired(
        "ACTIVE",
        expirationDate ?? existing.expirationDate
      );
      this.assertExistingLotCanReceive(
        existing,
        expirationDate,
        input.requiresExpiration
      );
      return existing;
    }

    this.assertActiveLotIsNotExpired("ACTIVE", expirationDate);

    const now = new Date();
    const lot = InventoryLotEntity.create({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      branchId,
      productId,
      supplierId: null,
      purchaseId: null,
      purchaseItemId: null,
      lotCode,
      expirationDate,
      receivedAt,
      unitCost,
      status: "ACTIVE",
      isLegacy: false,
      createdAt: now,
      updatedAt: now,
    });

    return this.inventoryLotRepository.create(
      {
        id: lot.id,
        tenantId: lot.tenantId,
        branchId: lot.branchId,
        productId: lot.productId,
        supplierId: lot.supplierId,
        purchaseId: lot.purchaseId,
        purchaseItemId: lot.purchaseItemId,
        lotCode: lot.lotCode,
        expirationDate: lot.expirationDate,
        receivedAt: lot.receivedAt,
        unitCost: lot.unitCost,
        status: lot.status,
        isLegacy: lot.isLegacy,
        createdAt: lot.createdAt,
        updatedAt: lot.updatedAt,
      },
      client
    );
  }

  async findForAdjustmentOut(
    input: FindAdjustmentOutLotInput,
    client?: PoolClient
  ) {
    const branchId = this.normalizeRequired(input.branchId, "branchId");
    const productId = this.normalizeRequired(input.productId, "productId");
    const lotCode = this.normalizeLotCode(input.lotCode);
    const expirationDate =
      this.parseDateOnly(input.expirationDate, "expirationDate") ?? null;
    this.assertExpirationFloor(expirationDate);

    const existing = await this.inventoryLotRepository.findByCode(
      input.tenantId,
      branchId,
      productId,
      lotCode,
      client
    );
    if (!existing) {
      throw new BadRequestException("inventory lot not found for adjustment");
    }

    this.assertExistingLotCanAdjustOut(existing);
    this.assertExpirationMatchesExistingLot(existing, expirationDate);
    return existing;
  }

  async update(input: UpdateInventoryLotInput, actor: InventoryLotActor) {
    const current = this.assertLotFound(
      await this.inventoryLotRepository.findById(input.tenantId, input.lotId)
    );
    await this.assertBranchAccess(input.tenantId, current.branchId, actor);

    const payload = this.buildUpdatePayload(input);
    await this.assertOptionalRelations(input.tenantId, payload);

    const nextStatus = payload.status ?? current.status;
    const nextExpirationDate =
      payload.expirationDate !== undefined
        ? payload.expirationDate
        : current.expirationDate;

    this.assertStatusTransition(current, nextStatus);
    this.assertExpirationFloor(nextExpirationDate);
    const productPolicy = await this.getProductLotPolicy(
      input.tenantId,
      current.productId
    );
    this.assertExpirationRequirement(
      productPolicy.requires_expiration,
      nextExpirationDate
    );
    this.assertActiveLotIsNotExpired(nextStatus, nextExpirationDate);

    if (payload.lotCode !== undefined) {
      // TODO Fase 3.5: bloquear cambio si existen saldos o movimientos loteados.
      await this.assertLotCodeUnique(
        input.tenantId,
        current.branchId,
        current.productId,
        payload.lotCode,
        input.lotId
      );
    }

    const updated = await this.inventoryLotRepository.update(
      input.tenantId,
      input.lotId,
      {
        supplierId: payload.supplierId,
        purchaseId: payload.purchaseId,
        purchaseItemId: payload.purchaseItemId,
        lotCode: payload.lotCode,
        expirationDate: payload.expirationDate,
        receivedAt: payload.receivedAt,
        unitCost: payload.unitCost,
        status: payload.status,
        isLegacy: payload.isLegacy,
      }
    );

    return this.assertLotFound(updated);
  }

  async block(tenantId: string, lotId: string, actor: InventoryLotActor) {
    const current = await this.findById(tenantId, lotId, actor);
    const blocked = await this.inventoryLotRepository.updateStatus(
      tenantId,
      current.id,
      "BLOCKED"
    );
    return this.assertLotFound(blocked);
  }

  async cancel(tenantId: string, lotId: string, actor: InventoryLotActor) {
    const current = await this.findById(tenantId, lotId, actor);
    if (current.status === "CONSUMED") {
      throw new BadRequestException("CONSUMED lot cannot be cancelled");
    }

    const cancelled = await this.inventoryLotRepository.updateStatus(
      tenantId,
      current.id,
      "CANCELLED"
    );
    return this.assertLotFound(cancelled);
  }
}
