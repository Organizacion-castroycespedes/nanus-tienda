import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  InventoryLotEntity,
  type InventoryLotProps,
} from "../entities/inventory-lot.entity";
import { InventoryLotService } from "./inventory-lot.service";

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const userId = randomUUID();
const branchId = randomUUID();
const otherBranchId = randomUUID();
const otherTenantBranchId = randomUUID();
const productId = randomUUID();
const otherProductId = randomUUID();
const otherTenantProductId = randomUUID();
const supplierId = randomUUID();
const purchaseId = randomUUID();
const purchaseItemId = randomUUID();

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

const buildLot = (
  overrides: Partial<InventoryLotProps> = {}
): InventoryLotEntity =>
  InventoryLotEntity.create({
    id: randomUUID(),
    tenantId,
    branchId,
    productId,
    supplierId: null,
    purchaseId: null,
    purchaseItemId: null,
    lotCode: "LOT-001",
    expirationDate: null,
    receivedAt: new Date("2026-01-01T00:00:00.000Z"),
    unitCost: 0,
    status: "ACTIVE",
    isLegacy: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

const toProps = (lot: InventoryLotEntity): InventoryLotProps => ({
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

const buildService = (
  initialLots: InventoryLotEntity[] = [],
  options: {
    accessibleBranchIds?: string[];
    products?: Array<{
      tenantId: string;
      productId: string;
      requiresExpiration: boolean;
    }>;
  } = {}
) => {
  const lots = [...initialLots];
  const accessibleBranchIds = options.accessibleBranchIds ?? [branchId];
  const branches = [
    { tenantId, branchId },
    { tenantId, branchId: otherBranchId },
    { tenantId: otherTenantId, branchId: otherTenantBranchId },
  ];
  const products =
    options.products ??
    [
      { tenantId, productId, requiresExpiration: false },
      { tenantId, productId: otherProductId, requiresExpiration: false },
      {
        tenantId: otherTenantId,
        productId: otherTenantProductId,
        requiresExpiration: false,
      },
    ];
  const suppliers = [{ tenantId, supplierId }];
  const purchases = [{ tenantId, purchaseId }];
  const purchaseItems = [{ tenantId, purchaseItemId }];

  const repository = {
    findMany: async (
      requestedTenantId: string,
      filters: {
        branchId?: string;
        productId?: string;
        supplierId?: string;
        status?: string;
        isLegacy?: boolean;
        search?: string;
      } = {}
    ) =>
      lots.filter((lot) => {
        const search = filters.search?.toLowerCase();
        return (
          lot.tenantId === requestedTenantId &&
          (!filters.branchId || lot.branchId === filters.branchId) &&
          (!filters.productId || lot.productId === filters.productId) &&
          (!filters.supplierId || lot.supplierId === filters.supplierId) &&
          (!filters.status || lot.status === filters.status) &&
          (filters.isLegacy === undefined ||
            lot.isLegacy === filters.isLegacy) &&
          (!search || lot.lotCode.toLowerCase().includes(search))
        );
      }),
    findById: async (requestedTenantId: string, lotId: string) =>
      lots.find(
        (lot) => lot.tenantId === requestedTenantId && lot.id === lotId
      ) ?? null,
    findByCode: async (
      requestedTenantId: string,
      requestedBranchId: string,
      requestedProductId: string,
      lotCode: string
    ) =>
      lots.find(
        (lot) =>
          lot.tenantId === requestedTenantId &&
          lot.branchId === requestedBranchId &&
          lot.productId === requestedProductId &&
          lot.lotCode === lotCode.trim().toUpperCase()
      ) ?? null,
    create: async (data: InventoryLotProps) => {
      const created = InventoryLotEntity.create(data);
      lots.push(created);
      return created;
    },
    update: async (
      requestedTenantId: string,
      lotId: string,
      data: Partial<InventoryLotProps>
    ) => {
      const index = lots.findIndex(
        (lot) => lot.tenantId === requestedTenantId && lot.id === lotId
      );
      if (index < 0) {
        return null;
      }
      const definedData = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
      );
      const updated = InventoryLotEntity.create({
        ...toProps(lots[index]),
        ...definedData,
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      lots[index] = updated;
      return updated;
    },
    updateStatus: async (
      requestedTenantId: string,
      lotId: string,
      status: InventoryLotProps["status"]
    ) => repository.update(requestedTenantId, lotId, { status }),
    validateBranchBelongsToTenant: async (
      requestedTenantId: string,
      requestedBranchId: string
    ) =>
      branches.some(
        (branch) =>
          branch.tenantId === requestedTenantId &&
          branch.branchId === requestedBranchId
      ),
    validateProductBelongsToTenant: async (
      requestedTenantId: string,
      requestedProductId: string
    ) =>
      products.some(
        (product) =>
          product.tenantId === requestedTenantId &&
          product.productId === requestedProductId
      ),
    findProductLotPolicy: async (
      requestedTenantId: string,
      requestedProductId: string
    ) => {
      const product = products.find(
        (item) =>
          item.tenantId === requestedTenantId &&
          item.productId === requestedProductId
      );
      return product
        ? {
            id: product.productId,
            tenant_id: product.tenantId,
            requires_expiration: product.requiresExpiration,
          }
        : null;
    },
    validateSupplierBelongsToTenant: async (
      requestedTenantId: string,
      requestedSupplierId: string
    ) =>
      suppliers.some(
        (supplier) =>
          supplier.tenantId === requestedTenantId &&
          supplier.supplierId === requestedSupplierId
      ),
    validatePurchaseBelongsToTenant: async (
      requestedTenantId: string,
      requestedPurchaseId: string
    ) =>
      purchases.some(
        (purchase) =>
          purchase.tenantId === requestedTenantId &&
          purchase.purchaseId === requestedPurchaseId
      ),
    validatePurchaseItemBelongsToTenant: async (
      requestedTenantId: string,
      requestedPurchaseItemId: string
    ) =>
      purchaseItems.some(
        (item) =>
          item.tenantId === requestedTenantId &&
          item.purchaseItemId === requestedPurchaseItemId
      ),
  };

  const financeAccessRepository = {
    findAccessibleBranchIds: async () => accessibleBranchIds,
  };

  return {
    lots,
    service: new InventoryLotService(
      repository as any,
      financeAccessRepository as any
    ),
  };
};

describe("InventoryLotService", () => {
  it("creates a basic ACTIVE lot", async () => {
    const context = buildService();

    const lot = await context.service.create(
      {
        tenantId,
        branchId,
        productId,
        lotCode: "LOT-A",
      },
      adminActor
    );

    assert.equal(lot.status, "ACTIVE");
    assert.equal(lot.unitCost, 0);
    assert.equal(lot.isLegacy, false);
    assert.equal(lot.expirationDate, null);
  });

  it("normalizes lotCode with trim and uppercase", async () => {
    const context = buildService();

    const lot = await context.service.create(
      {
        tenantId,
        branchId,
        productId,
        lotCode: "  abc-123 ",
      },
      adminActor
    );

    assert.equal(lot.lotCode, "ABC-123");
  });

  it("rejects a branch from another tenant", async () => {
    const context = buildService([], {
      accessibleBranchIds: [otherTenantBranchId],
    });

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId: otherTenantBranchId,
            productId,
            lotCode: "LOT-A",
          },
          superActor
        ),
      /branchId is invalid/
    );
  });

  it("rejects a product from another tenant", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId,
            productId: otherTenantProductId,
            lotCode: "LOT-A",
          },
          adminActor
        ),
      /productId is invalid/
    );
  });

  it("rejects empty lotCode", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId,
            productId,
            lotCode: "   ",
          },
          adminActor
        ),
      /lotCode is required/
    );
  });

  it("rejects negative unitCost", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId,
            productId,
            lotCode: "LOT-A",
            unitCost: -1,
          },
          adminActor
        ),
      /unitCost must be non-negative/
    );
  });

  it("rejects invalid status", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId,
            productId,
            lotCode: "LOT-A",
            status: "HOLD" as any,
          },
          adminActor
        ),
      /status is invalid/
    );
  });

  it("rejects duplicate lotCode in the same tenant branch and product", async () => {
    const context = buildService([buildLot({ lotCode: "LOT-A" })]);

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId,
            productId,
            lotCode: " lot-a ",
          },
          adminActor
        ),
      /lotCode already exists for this product/
    );
  });

  it("allows same lotCode for another product or branch", async () => {
    const context = buildService([buildLot({ lotCode: "LOT-A" })]);

    const otherProductLot = await context.service.create(
      {
        tenantId,
        branchId,
        productId: otherProductId,
        lotCode: "LOT-A",
      },
      adminActor
    );
    const otherBranchLot = await context.service.create(
      {
        tenantId,
        branchId: otherBranchId,
        productId,
        lotCode: "LOT-A",
      },
      superActor
    );

    assert.equal(otherProductLot.productId, otherProductId);
    assert.equal(otherBranchLot.branchId, otherBranchId);
  });

  it("requires expirationDate when product requires expiration", async () => {
    const context = buildService([], {
      products: [{ tenantId, productId, requiresExpiration: true }],
    });

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId,
            productId,
            lotCode: "LOT-A",
          },
          adminActor
        ),
      /expirationDate is required for this product/
    );
  });

  it("does not require expirationDate when product does not require expiration", async () => {
    const context = buildService();

    const lot = await context.service.create(
      {
        tenantId,
        branchId,
        productId,
        lotCode: "LOT-A",
      },
      adminActor
    );

    assert.equal(lot.expirationDate, null);
  });

  it("rejects expirationDate before 2000-01-01", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId,
            productId,
            lotCode: "LOT-A",
            expirationDate: "1999-12-31",
          },
          adminActor
        ),
      /expirationDate cannot be before 2000-01-01/
    );
  });

  it("rejects ACTIVE lot with expired expirationDate", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.create(
          {
            tenantId,
            branchId,
            productId,
            lotCode: "LOT-A",
            expirationDate: "2020-01-01",
          },
          adminActor
        ),
      /ACTIVE lot cannot be expired/
    );
  });

  it("blocks a lot", async () => {
    const current = buildLot({ status: "ACTIVE" });
    const context = buildService([current]);

    const blocked = await context.service.block(tenantId, current.id, adminActor);

    assert.equal(blocked.status, "BLOCKED");
  });

  it("cancels a lot", async () => {
    const current = buildLot({ status: "ACTIVE" });
    const context = buildService([current]);

    const cancelled = await context.service.cancel(
      tenantId,
      current.id,
      adminActor
    );

    assert.equal(cancelled.status, "CANCELLED");
  });

  it("does not cancel a CONSUMED lot", async () => {
    const current = buildLot({ status: "CONSUMED" });
    const context = buildService([current]);

    await assert.rejects(
      () => context.service.cancel(tenantId, current.id, adminActor),
      /CONSUMED lot cannot be cancelled/
    );
  });

  it("does not operate a lot from another tenant", async () => {
    const current = buildLot({
      tenantId: otherTenantId,
      branchId: otherTenantBranchId,
      productId: otherTenantProductId,
    });
    const context = buildService([current]);

    await assert.rejects(
      () => context.service.findById(tenantId, current.id, adminActor),
      /inventory lot not found/
    );
  });
});
