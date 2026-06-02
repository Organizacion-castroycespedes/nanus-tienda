import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  InventoryLocationEntity,
  type InventoryLocationProps,
} from "../entities/inventory-location.entity";
import { InventoryLocationService } from "./inventory-location.service";

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const userId = randomUUID();
const branchId = randomUUID();
const otherBranchId = randomUUID();
const otherTenantBranchId = randomUUID();

const adminActor = {
  roles: ["ADMIN"],
  userId,
  tenantId,
  branchId,
};

const superActor = {
  roles: ["SUPER_USER"],
  userId,
  tenantId,
};

const buildLocation = (
  overrides: Partial<InventoryLocationProps> = {}
): InventoryLocationEntity =>
  InventoryLocationEntity.create({
    id: randomUUID(),
    tenantId,
    branchId,
    code: "A1",
    name: "Pasillo A1",
    type: "OTHER",
    description: null,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

const toProps = (
  location: InventoryLocationEntity
): InventoryLocationProps => ({
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

const buildService = (
  initialLocations: InventoryLocationEntity[] = [],
  accessibleBranchIds: string[] = [branchId]
) => {
  const locations = [...initialLocations];
  const branches = [
    { tenantId, branchId },
    { tenantId, branchId: otherBranchId },
    { tenantId: otherTenantId, branchId: otherTenantBranchId },
  ];

  const repository = {
    findByTenantAndBranch: async (
      requestedTenantId: string,
      requestedBranchId?: string,
      filters: {
        type?: string;
        isActive?: boolean;
        search?: string;
      } = {}
    ) =>
      locations.filter((location) => {
        const search = filters.search?.toLowerCase();
        return (
          location.tenantId === requestedTenantId &&
          (!requestedBranchId || location.branchId === requestedBranchId) &&
          (!filters.type || location.type === filters.type) &&
          (filters.isActive === undefined ||
            location.isActive === filters.isActive) &&
          (!search ||
            location.code.toLowerCase().includes(search) ||
            location.name.toLowerCase().includes(search))
        );
      }),
    findById: async (requestedTenantId: string, locationId: string) =>
      locations.find(
        (location) =>
          location.tenantId === requestedTenantId && location.id === locationId
      ) ?? null,
    findByCode: async (
      requestedTenantId: string,
      requestedBranchId: string,
      code: string
    ) =>
      locations.find(
        (location) =>
          location.tenantId === requestedTenantId &&
          location.branchId === requestedBranchId &&
          location.code === code.trim().toUpperCase()
      ) ?? null,
    create: async (data: InventoryLocationProps) => {
      const created = InventoryLocationEntity.create(data);
      locations.push(created);
      return created;
    },
    update: async (
      requestedTenantId: string,
      locationId: string,
      data: Partial<InventoryLocationProps>
    ) => {
      const index = locations.findIndex(
        (location) =>
          location.tenantId === requestedTenantId && location.id === locationId
      );
      if (index < 0) {
        return null;
      }
      const definedData = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
      );
      const updated = InventoryLocationEntity.create({
        ...toProps(locations[index]),
        ...definedData,
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      locations[index] = updated;
      return updated;
    },
    deactivate: async (requestedTenantId: string, locationId: string) =>
      repository.update(requestedTenantId, locationId, {
        isActive: false,
      }),
    validateBranchBelongsToTenant: async (
      requestedTenantId: string,
      requestedBranchId: string
    ) =>
      branches.some(
        (branch) =>
          branch.tenantId === requestedTenantId &&
          branch.branchId === requestedBranchId
      ),
  };

  const financeAccessRepository = {
    findAccessibleBranchIds: async () => accessibleBranchIds,
  };

  return {
    locations,
    service: new InventoryLocationService(
      repository as any,
      financeAccessRepository as any
    ),
  };
};

describe("InventoryLocationService", () => {
  it("creates a location with OTHER type by default", async () => {
    const context = buildService();

    const location = await context.service.create(
      {
        tenantId,
        branchId,
        code: "main",
        name: "Bodega principal",
      },
      adminActor
    );

    assert.equal(location.type, "OTHER");
    assert.equal(location.isActive, true);
  });

  it("trims and uppercases code when creating a location", async () => {
    const context = buildService();

    const location = await context.service.create(
      {
        tenantId,
        branchId,
        code: "  cold-1 ",
        name: " Cuarto frio ",
        type: "COLD_ROOM",
      },
      adminActor
    );

    assert.equal(location.code, "COLD-1");
    assert.equal(location.name, "Cuarto frio");
  });

  it("rejects a branch from another tenant", async () => {
    const context = buildService([], [otherTenantBranchId]);

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId: otherTenantBranchId,
            code: "OTRO",
            name: "Otra sucursal",
          },
          superActor
        ),
      /branchId is invalid/
    );
  });

  it("rejects empty code", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId,
            code: "   ",
            name: "Bodega",
          },
          adminActor
        ),
      /code is required/
    );
  });

  it("rejects empty name", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId,
            code: "BOD",
            name: "   ",
          },
          adminActor
        ),
      /name is required/
    );
  });

  it("rejects invalid type", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId,
            code: "PALLET",
            name: "Pallet",
            type: "PALLET" as any,
          },
          adminActor
        ),
      /type is invalid/
    );
  });

  it("rejects duplicated code in the same branch", async () => {
    const context = buildService([buildLocation({ code: "A1" })]);

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId,
            code: " a1 ",
            name: "Duplicada",
          },
          adminActor
        ),
      /code already exists for this branch/
    );
  });

  it("allows the same code in another branch for the same tenant", async () => {
    const context = buildService([buildLocation({ code: "A1" })]);

    const location = await context.service.create(
      {
        tenantId,
        branchId: otherBranchId,
        code: "A1",
        name: "Otra sucursal",
      },
      superActor
    );

    assert.equal(location.branchId, otherBranchId);
    assert.equal(location.code, "A1");
  });

  it("updates name type and description", async () => {
    const current = buildLocation({
      name: "Vieja",
      type: "SHELF",
      description: null,
    });
    const context = buildService([current]);

    const updated = await context.service.update(
      {
        tenantId,
        locationId: current.id,
        name: "Nueva",
        type: "DISPLAY",
        description: "  Mostrador principal ",
      },
      adminActor
    );

    assert.equal(updated.name, "Nueva");
    assert.equal(updated.type, "DISPLAY");
    assert.equal(updated.description, "Mostrador principal");
  });

  it("does not allow moving a location to another branch", async () => {
    const current = buildLocation();
    const context = buildService([current]);

    await assert.rejects(
      () =>
        context.service.update(
          {
            tenantId,
            locationId: current.id,
            branchId: otherBranchId,
          },
          adminActor
        ),
      /branchId cannot be updated/
    );
  });

  it("deactivates a location without deleting it", async () => {
    const current = buildLocation({ isActive: true });
    const context = buildService([current]);

    const deactivated = await context.service.deactivate(
      tenantId,
      current.id,
      adminActor
    );

    assert.equal(deactivated.isActive, false);
    assert.equal(context.locations.length, 1);
  });

  it("does not operate a location from another tenant", async () => {
    const current = buildLocation({
      tenantId: otherTenantId,
      branchId: otherTenantBranchId,
    });
    const context = buildService([current]);

    await assert.rejects(
      () => context.service.getById(tenantId, current.id, adminActor),
      /inventory location not found/
    );
  });
});
