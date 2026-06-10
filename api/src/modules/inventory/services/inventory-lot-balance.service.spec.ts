import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  InventoryLotBalanceEntity,
  type InventoryLotBalanceProps,
} from "../entities/inventory-lot-balance.entity";
import { InventoryLotBalanceService } from "./inventory-lot-balance.service";

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const userId = randomUUID();
const branchId = randomUUID();
const otherBranchId = randomUUID();
const productId = randomUUID();
const otherProductId = randomUUID();
const lotId = randomUUID();
const otherTenantLotId = randomUUID();
const otherBranchLotId = randomUUID();
const otherProductLotId = randomUUID();
const locationId = randomUUID();
const otherBranchLocationId = randomUUID();

const adminActor = {
  roles: ["ADMIN"],
  userId,
  tenantId,
  branchId,
};

const buildBalance = (
  overrides: Partial<InventoryLotBalanceProps> = {}
): InventoryLotBalanceEntity =>
  InventoryLotBalanceEntity.create({
    id: randomUUID(),
    tenantId,
    branchId,
    productId,
    lotId,
    locationId: null,
    quantityOnHand: 10,
    quantityReserved: 0,
    lastMovementAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

const toProps = (
  balance: InventoryLotBalanceEntity
): InventoryLotBalanceProps => ({
  id: balance.id,
  tenantId: balance.tenantId,
  branchId: balance.branchId,
  productId: balance.productId,
  lotId: balance.lotId,
  locationId: balance.locationId,
  quantityOnHand: balance.quantityOnHand,
  quantityReserved: balance.quantityReserved,
  quantityAvailable: balance.quantityAvailable,
  lastMovementAt: balance.lastMovementAt,
  createdAt: balance.createdAt,
  updatedAt: balance.updatedAt,
});

const buildService = (
  initialBalances: InventoryLotBalanceEntity[] = [],
  accessibleBranchIds: string[] = [branchId]
) => {
  const balances = [...initialBalances];
  const branches = [
    { tenant_id: tenantId, id: branchId },
    { tenant_id: tenantId, id: otherBranchId },
    { tenant_id: otherTenantId, id: randomUUID() },
  ];
  const lots = [
    {
      id: lotId,
      tenant_id: tenantId,
      branch_id: branchId,
      product_id: productId,
      status: "ACTIVE",
      expiration_date: new Date("2026-12-31T00:00:00.000Z"),
    },
    {
      id: otherTenantLotId,
      tenant_id: otherTenantId,
      branch_id: branchId,
      product_id: productId,
      status: "ACTIVE",
      expiration_date: null,
    },
    {
      id: otherBranchLotId,
      tenant_id: tenantId,
      branch_id: otherBranchId,
      product_id: productId,
      status: "ACTIVE",
      expiration_date: null,
    },
    {
      id: otherProductLotId,
      tenant_id: tenantId,
      branch_id: branchId,
      product_id: otherProductId,
      status: "ACTIVE",
      expiration_date: null,
    },
  ];
  const locations = [
    { id: locationId, tenant_id: tenantId, branch_id: branchId },
    {
      id: otherBranchLocationId,
      tenant_id: tenantId,
      branch_id: otherBranchId,
    },
  ];

  const updateBalance = (
    index: number,
    data: Partial<InventoryLotBalanceProps>
  ) => {
    const updated = InventoryLotBalanceEntity.create({
      ...toProps(balances[index]),
      ...Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
      ),
      quantityAvailable: undefined,
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    balances[index] = updated;
    return updated;
  };

  const repository = {
    findMany: async (
      requestedTenantId: string,
      filters: {
        branchId?: string;
        productId?: string;
        lotId?: string;
        locationId?: string | null;
        onlyAvailable?: boolean;
        onlyActiveLots?: boolean;
        expirationFrom?: Date;
        expirationTo?: Date;
      } = {}
    ) =>
      balances.filter((balance) => {
        const lot = lots.find((item) => item.id === balance.lotId);
        return (
          balance.tenantId === requestedTenantId &&
          (!filters.branchId || balance.branchId === filters.branchId) &&
          (!filters.productId || balance.productId === filters.productId) &&
          (!filters.lotId || balance.lotId === filters.lotId) &&
          (filters.locationId === undefined ||
            balance.locationId === filters.locationId) &&
          (!filters.onlyAvailable || balance.quantityAvailable > 0) &&
          (!filters.onlyActiveLots || lot?.status === "ACTIVE") &&
          (!filters.expirationFrom ||
            !lot?.expiration_date ||
            lot.expiration_date >= filters.expirationFrom) &&
          (!filters.expirationTo ||
            !lot?.expiration_date ||
            lot.expiration_date <= filters.expirationTo)
        );
      }),
    findById: async (requestedTenantId: string, balanceId: string) =>
      balances.find(
        (balance) =>
          balance.tenantId === requestedTenantId && balance.id === balanceId
      ) ?? null,
    findByLot: async (requestedTenantId: string, requestedLotId: string) =>
      balances.filter(
        (balance) =>
          balance.tenantId === requestedTenantId &&
          balance.lotId === requestedLotId
      ),
    findByProductBranch: async (
      requestedTenantId: string,
      requestedBranchId: string,
      requestedProductId: string
    ) =>
      balances.filter(
        (balance) =>
          balance.tenantId === requestedTenantId &&
          balance.branchId === requestedBranchId &&
          balance.productId === requestedProductId
      ),
    findByLotLocation: async (
      requestedTenantId: string,
      requestedBranchId: string,
      requestedProductId: string,
      requestedLotId: string,
      requestedLocationId?: string | null
    ) =>
      balances.find(
        (balance) =>
          balance.tenantId === requestedTenantId &&
          balance.branchId === requestedBranchId &&
          balance.productId === requestedProductId &&
          balance.lotId === requestedLotId &&
          balance.locationId === (requestedLocationId ?? null)
      ) ?? null,
    create: async (data: InventoryLotBalanceProps) => {
      const created = InventoryLotBalanceEntity.create(data);
      balances.push(created);
      return created;
    },
    updateQuantities: async (
      requestedTenantId: string,
      balanceId: string,
      data: Partial<InventoryLotBalanceProps>
    ) => {
      const index = balances.findIndex(
        (balance) =>
          balance.tenantId === requestedTenantId && balance.id === balanceId
      );
      return index < 0 ? null : updateBalance(index, data);
    },
    incrementOnHand: async (
      requestedTenantId: string,
      input: { branchId: string; productId: string; lotId: string; quantity: number }
    ) => {
      const balance = await repository.findByLotLocation(
        requestedTenantId,
        input.branchId,
        input.productId,
        input.lotId,
        null
      );
      if (!balance) {
        return null;
      }
      return repository.updateQuantities(requestedTenantId, balance.id, {
        quantityOnHand: balance.quantityOnHand + input.quantity,
      });
    },
    decrementOnHand: async (
      requestedTenantId: string,
      input: { branchId: string; productId: string; lotId: string; quantity: number }
    ) => {
      const balance = await repository.findByLotLocation(
        requestedTenantId,
        input.branchId,
        input.productId,
        input.lotId,
        null
      );
      if (!balance) {
        return null;
      }
      return repository.updateQuantities(requestedTenantId, balance.id, {
        quantityOnHand: balance.quantityOnHand - input.quantity,
      });
    },
    reserve: async (
      requestedTenantId: string,
      input: { branchId: string; productId: string; lotId: string; quantity: number }
    ) => {
      const balance = await repository.findByLotLocation(
        requestedTenantId,
        input.branchId,
        input.productId,
        input.lotId,
        null
      );
      if (!balance) {
        return null;
      }
      return repository.updateQuantities(requestedTenantId, balance.id, {
        quantityReserved: balance.quantityReserved + input.quantity,
      });
    },
    releaseReservation: async (
      requestedTenantId: string,
      input: { branchId: string; productId: string; lotId: string; quantity: number }
    ) => {
      const balance = await repository.findByLotLocation(
        requestedTenantId,
        input.branchId,
        input.productId,
        input.lotId,
        null
      );
      if (!balance) {
        return null;
      }
      return repository.updateQuantities(requestedTenantId, balance.id, {
        quantityReserved: balance.quantityReserved - input.quantity,
      });
    },
    validateLotBelongsToTenant: async (
      requestedTenantId: string,
      requestedLotId: string
    ) =>
      lots.find(
        (lot) =>
          lot.tenant_id === requestedTenantId && lot.id === requestedLotId
      ) ?? null,
    validateLocationBelongsToTenantBranch: async (
      requestedTenantId: string,
      requestedBranchId: string,
      requestedLocationId: string
    ) =>
      locations.find(
        (location) =>
          location.tenant_id === requestedTenantId &&
          location.branch_id === requestedBranchId &&
          location.id === requestedLocationId
      ) ?? null,
  };

  const financeAccessRepository = {
    findBranchById: async (
      requestedBranchId: string,
      requestedTenantId: string
    ) =>
      branches.find(
        (branch) =>
          branch.id === requestedBranchId &&
          branch.tenant_id === requestedTenantId
      ) ?? null,
    findAccessibleBranchIds: async () => accessibleBranchIds,
  };

  return {
    balances,
    service: new InventoryLotBalanceService(
      repository as any,
      financeAccessRepository as any
    ),
  };
};

describe("InventoryLotBalanceService", () => {
  it("creates a valid balance", async () => {
    const context = buildService();

    const balance = await context.service.createBalance({
      tenantId,
      branchId,
      productId,
      lotId,
      locationId,
      quantityOnHand: 8,
      quantityReserved: 2,
    });

    assert.equal(balance.branchId, branchId);
    assert.equal(balance.productId, productId);
    assert.equal(balance.lotId, lotId);
    assert.equal(balance.locationId, locationId);
    assert.equal(balance.quantityAvailable, 6);
  });

  it("rejects a lot from another tenant", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.createBalance({
          tenantId,
          branchId,
          productId,
          lotId: otherTenantLotId,
        }),
      /lotId is invalid/
    );
  });

  it("rejects branch and product that do not match the lot", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.createBalance({
          tenantId,
          branchId: otherBranchId,
          productId,
          lotId,
        }),
      /branchId does not match lot/
    );

    await assert.rejects(
      () =>
        context.service.createBalance({
          tenantId,
          branchId,
          productId: otherProductId,
          lotId,
        }),
      /productId does not match lot/
    );
  });

  it("rejects a location from another branch", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.createBalance({
          tenantId,
          branchId,
          productId,
          lotId,
          locationId: otherBranchLocationId,
        }),
      /locationId is invalid/
    );
  });

  it("rejects reserved quantity above on hand", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.createBalance({
          tenantId,
          branchId,
          productId,
          lotId,
          quantityOnHand: 3,
          quantityReserved: 4,
        }),
      /quantityReserved cannot exceed quantityOnHand/
    );
  });

  it("increments onHand", async () => {
    const context = buildService([
      buildBalance({ quantityOnHand: 10, quantityReserved: 2 }),
    ]);

    const balance = await context.service.incrementOnHand(tenantId, {
      branchId,
      productId,
      lotId,
      quantity: 4,
    });

    assert.equal(balance.quantityOnHand, 14);
    assert.equal(balance.quantityAvailable, 12);
  });

  it("rejects decrement below available", async () => {
    const context = buildService([
      buildBalance({ quantityOnHand: 5, quantityReserved: 3 }),
    ]);

    await assert.rejects(
      () =>
        context.service.decrementOnHand(tenantId, {
          branchId,
          productId,
          lotId,
          quantity: 3,
        }),
      /quantity exceeds available stock/
    );
  });

  it("reserves available quantity", async () => {
    const context = buildService([
      buildBalance({ quantityOnHand: 10, quantityReserved: 2 }),
    ]);

    const balance = await context.service.reserve(tenantId, {
      branchId,
      productId,
      lotId,
      quantity: 3,
    });

    assert.equal(balance.quantityReserved, 5);
    assert.equal(balance.quantityAvailable, 5);
  });

  it("rejects reservation above available quantity", async () => {
    const context = buildService([
      buildBalance({ quantityOnHand: 5, quantityReserved: 3 }),
    ]);

    await assert.rejects(
      () =>
        context.service.reserve(tenantId, {
          branchId,
          productId,
          lotId,
          quantity: 3,
        }),
      /quantity exceeds available stock/
    );
  });

  it("releases reserved quantity", async () => {
    const context = buildService([
      buildBalance({ quantityOnHand: 10, quantityReserved: 5 }),
    ]);

    const balance = await context.service.releaseReservation(tenantId, {
      branchId,
      productId,
      lotId,
      quantity: 3,
    });

    assert.equal(balance.quantityReserved, 2);
    assert.equal(balance.quantityAvailable, 8);
  });

  it("rejects releasing more than reserved", async () => {
    const context = buildService([
      buildBalance({ quantityOnHand: 10, quantityReserved: 2 }),
    ]);

    await assert.rejects(
      () =>
        context.service.releaseReservation(tenantId, {
          branchId,
          productId,
          lotId,
          quantity: 3,
        }),
      /quantity exceeds reserved stock/
    );
  });

  it("lists balances with filters", async () => {
    const context = buildService([
      buildBalance({ quantityOnHand: 10, quantityReserved: 2 }),
      buildBalance({
        productId: otherProductId,
        lotId: otherProductLotId,
        quantityOnHand: 0,
      }),
      buildBalance({
        branchId: otherBranchId,
        lotId: otherBranchLotId,
      }),
    ]);

    const balances = await context.service.findMany(
      tenantId,
      { branchId, productId, onlyAvailable: true },
      adminActor
    );

    assert.equal(balances.length, 1);
    assert.equal(balances[0].lotId, lotId);
  });
});
