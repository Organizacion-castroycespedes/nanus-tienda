import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import { FinanceAccessRepository } from "../../finance/common/repositories/finance-access.repository";
import {
  INVENTORY_LOCATION_TYPES,
  InventoryLocationEntity,
  type InventoryLocationType,
} from "../entities/inventory-location.entity";
import {
  InventoryLocationRepository,
  type InventoryLocationFilters,
} from "../repositories/inventory-location.repository";
import { canViewAllBranches } from "../utils/access";

type InventoryLocationActor = {
  roles: string[];
  userId?: string;
  tenantId?: string;
  branchId?: string;
};

type ListInventoryLocationsInput = {
  branchId?: string;
  type?: InventoryLocationType;
  isActive?: boolean;
  search?: string;
};

type CreateInventoryLocationInput = {
  tenantId: string;
  branchId: string;
  code: string;
  name: string;
  type?: InventoryLocationType;
  description?: string | null;
};

type UpdateInventoryLocationInput = {
  tenantId: string;
  locationId: string;
  code?: string;
  name?: string;
  type?: InventoryLocationType;
  description?: string | null;
  isActive?: boolean;
  branchId?: string;
};

type InventoryLocationPayload = {
  code: string;
  name: string;
  type: InventoryLocationType;
  description: string | null;
};

@Injectable()
export class InventoryLocationService {
  constructor(
    @Inject(InventoryLocationRepository)
    private readonly inventoryLocationRepository: InventoryLocationRepository,
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

  private normalizeCode(code: string | undefined) {
    return this.normalizeRequired(code, "code").toUpperCase();
  }

  private normalizeDescription(value: string | null | undefined) {
    if (value === null) {
      return null;
    }

    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeType(type: InventoryLocationType | undefined) {
    const normalized = type ?? "OTHER";
    if (!INVENTORY_LOCATION_TYPES.includes(normalized)) {
      throw new BadRequestException("type is invalid");
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

  private async assertBranchBelongsToTenant(tenantId: string, branchId: string) {
    const branchExists =
      await this.inventoryLocationRepository.validateBranchBelongsToTenant(
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
    actor: InventoryLocationActor
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

  private async assertCodeUniqueInBranch(
    tenantId: string,
    branchId: string,
    code: string,
    excludeLocationId?: string
  ) {
    const existing = await this.inventoryLocationRepository.findByCode(
      tenantId,
      branchId,
      code
    );

    if (existing && existing.id !== excludeLocationId) {
      throw new BadRequestException("code already exists for this branch");
    }
  }

  private buildCreatePayload(
    input: CreateInventoryLocationInput
  ): InventoryLocationPayload {
    return {
      code: this.normalizeCode(input.code),
      name: this.normalizeRequired(input.name, "name"),
      type: this.normalizeType(input.type),
      description: this.normalizeDescription(input.description),
    };
  }

  private buildUpdatePayload(input: UpdateInventoryLocationInput) {
    this.assertOptionalBoolean(input.isActive, "isActive");

    if (input.branchId !== undefined) {
      throw new BadRequestException("branchId cannot be updated");
    }

    return {
      code:
        input.code !== undefined ? this.normalizeCode(input.code) : undefined,
      name:
        input.name !== undefined
          ? this.normalizeRequired(input.name, "name")
          : undefined,
      type:
        input.type !== undefined ? this.normalizeType(input.type) : undefined,
      description:
        input.description !== undefined
          ? this.normalizeDescription(input.description)
          : undefined,
      isActive: input.isActive,
    };
  }

  private assertLocationFound(
    location: InventoryLocationEntity | null
  ): InventoryLocationEntity {
    if (!location) {
      throw new NotFoundException("inventory location not found");
    }
    return location;
  }

  private resolveListBranchId(
    actor: InventoryLocationActor,
    branchId: string | undefined
  ) {
    const normalizedBranchId = branchId?.trim();

    if (canViewAllBranches(actor)) {
      return normalizedBranchId;
    }

    return normalizedBranchId ?? actor.branchId;
  }

  async list(
    tenantId: string,
    filters: ListInventoryLocationsInput,
    actor: InventoryLocationActor
  ) {
    const branchId = this.resolveListBranchId(actor, filters.branchId);
    const type = filters.type ? this.normalizeType(filters.type) : undefined;
    const search = filters.search?.trim();

    if (branchId) {
      await this.assertBranchAccess(tenantId, branchId, actor);
    } else if (!canViewAllBranches(actor)) {
      throw new BadRequestException("branchId is required");
    }

    return this.inventoryLocationRepository.findByTenantAndBranch(
      tenantId,
      branchId,
      {
        type,
        isActive: filters.isActive,
        search,
      } satisfies InventoryLocationFilters
    );
  }

  async getById(
    tenantId: string,
    locationId: string,
    actor: InventoryLocationActor
  ) {
    const current = this.assertLocationFound(
      await this.inventoryLocationRepository.findById(tenantId, locationId)
    );

    await this.assertBranchAccess(tenantId, current.branchId, actor);
    return current;
  }

  async create(
    input: CreateInventoryLocationInput,
    actor: InventoryLocationActor
  ) {
    const branchId = this.normalizeRequired(input.branchId, "branchId");
    await this.assertBranchAccess(input.tenantId, branchId, actor);

    const payload = this.buildCreatePayload({
      ...input,
      branchId,
    });
    await this.assertCodeUniqueInBranch(
      input.tenantId,
      branchId,
      payload.code
    );

    const now = new Date();
    const location = InventoryLocationEntity.create({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      branchId,
      code: payload.code,
      name: payload.name,
      type: payload.type,
      description: payload.description,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return this.inventoryLocationRepository.create({
      id: location.id,
      tenantId: location.tenantId,
      branchId: location.branchId,
      code: location.code,
      name: location.name,
      type: location.type,
      description: location.description,
      isActive: location.isActive,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    });
  }

  async update(
    input: UpdateInventoryLocationInput,
    actor: InventoryLocationActor
  ) {
    const current = this.assertLocationFound(
      await this.inventoryLocationRepository.findById(
        input.tenantId,
        input.locationId
      )
    );
    await this.assertBranchAccess(input.tenantId, current.branchId, actor);

    const payload = this.buildUpdatePayload(input);
    const nextCode = payload.code ?? current.code;

    if (payload.code !== undefined || payload.isActive === true) {
      await this.assertCodeUniqueInBranch(
        input.tenantId,
        current.branchId,
        nextCode,
        input.locationId
      );
    }

    const updated = await this.inventoryLocationRepository.update(
      input.tenantId,
      input.locationId,
      {
        code: payload.code,
        name: payload.name,
        type: payload.type,
        description: payload.description,
        isActive: payload.isActive,
      }
    );

    return this.assertLocationFound(updated);
  }

  async deactivate(
    tenantId: string,
    locationId: string,
    actor: InventoryLocationActor
  ) {
    const current = this.assertLocationFound(
      await this.inventoryLocationRepository.findById(tenantId, locationId)
    );
    await this.assertBranchAccess(tenantId, current.branchId, actor);

    const deactivated = await this.inventoryLocationRepository.deactivate(
      tenantId,
      locationId
    );
    return this.assertLocationFound(deactivated);
  }
}
