import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  StockMovementLotEntity,
  type StockMovementLotProps,
} from "../entities/stock-movement-lot.entity";
import { StockMovementLotService } from "./stock-movement-lot.service";

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const userId = randomUUID();
const branchId = randomUUID();
const productId = randomUUID();
const otherProductId = randomUUID();
const stockMovementId = randomUUID();
const otherTenantStockMovementId = randomUUID();
const lotId = randomUUID();
const otherTenantLotId = randomUUID();
const otherProductLotId = randomUUID();
const locationId = randomUUID();

const adminActor = {
  roles: ["ADMIN"],
  userId,
  tenantId,
  branchId,
};

const buildLink = (
  overrides: Partial<StockMovementLotProps> = {}
): StockMovementLotEntity =>
  StockMovementLotEntity.create({
    id: randomUUID(),
    tenantId,
    stockMovementId,
    productId,
    lotId,
    locationId: null,
    quantity: 2,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

const toProps = (link: StockMovementLotEntity): StockMovementLotProps => ({
  id: link.id,
  tenantId: link.tenantId,
  stockMovementId: link.stockMovementId,
  productId: link.productId,
  lotId: link.lotId,
  locationId: link.locationId,
  quantity: link.quantity,
  createdAt: link.createdAt,
});

const buildService = (
  initialLinks: StockMovementLotEntity[] = [],
  accessibleBranchIds: string[] = [branchId]
) => {
  const links = [...initialLinks];
  const movements = [
    {
      id: stockMovementId,
      tenant_id: tenantId,
      product_id: productId,
      branch_id: branchId,
    },
    {
      id: otherTenantStockMovementId,
      tenant_id: otherTenantId,
      product_id: productId,
      branch_id: branchId,
    },
  ];
  const lots = [
    {
      id: lotId,
      tenant_id: tenantId,
      branch_id: branchId,
      product_id: productId,
    },
    {
      id: otherTenantLotId,
      tenant_id: otherTenantId,
      branch_id: branchId,
      product_id: productId,
    },
    {
      id: otherProductLotId,
      tenant_id: tenantId,
      branch_id: branchId,
      product_id: otherProductId,
    },
  ];
  const locations = [
    { id: locationId, tenant_id: tenantId, branch_id: branchId },
  ];

  const repository = {
    findByMovement: async (
      requestedTenantId: string,
      requestedStockMovementId: string
    ) =>
      links.filter(
        (link) =>
          link.tenantId === requestedTenantId &&
          link.stockMovementId === requestedStockMovementId
      ),
    findByLot: async (requestedTenantId: string, requestedLotId: string) =>
      links.filter(
        (link) =>
          link.tenantId === requestedTenantId && link.lotId === requestedLotId
      ),
    findByProduct: async (requestedTenantId: string, requestedProductId: string) =>
      links.filter(
        (link) =>
          link.tenantId === requestedTenantId &&
          link.productId === requestedProductId
      ),
    create: async (data: StockMovementLotProps) => {
      const created = StockMovementLotEntity.create(data);
      links.push(created);
      return created;
    },
    validateStockMovementBelongsToTenant: async (
      requestedTenantId: string,
      requestedStockMovementId: string
    ) =>
      movements.find(
        (movement) =>
          movement.tenant_id === requestedTenantId &&
          movement.id === requestedStockMovementId
      ) ?? null,
    validateLotBelongsToTenant: async (
      requestedTenantId: string,
      requestedLotId: string
    ) =>
      lots.find(
        (lot) => lot.tenant_id === requestedTenantId && lot.id === requestedLotId
      ) ?? null,
    validateLocationBelongsToTenant: async (
      requestedTenantId: string,
      requestedLocationId: string
    ) =>
      locations.find(
        (location) =>
          location.tenant_id === requestedTenantId &&
          location.id === requestedLocationId
      ) ?? null,
  };

  const financeAccessRepository = {
    findAccessibleBranchIds: async () => accessibleBranchIds,
  };

  return {
    links,
    service: new StockMovementLotService(
      repository as any,
      financeAccessRepository as any
    ),
  };
};

describe("StockMovementLotService", () => {
  it("creates a valid internal link", async () => {
    const context = buildService();

    const link = await context.service.createLink({
      tenantId,
      stockMovementId,
      productId,
      lotId,
      locationId,
      quantity: 3,
    });

    assert.equal(link.stockMovementId, stockMovementId);
    assert.equal(link.productId, productId);
    assert.equal(link.lotId, lotId);
    assert.equal(link.locationId, locationId);
    assert.equal(link.quantity, 3);
  });

  it("rejects stock movement from another tenant", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.createLink({
          tenantId,
          stockMovementId: otherTenantStockMovementId,
          productId,
          quantity: 1,
        }),
      /stockMovementId is invalid/
    );
  });

  it("rejects productId that does not match stock movement", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.createLink({
          tenantId,
          stockMovementId,
          productId: otherProductId,
          quantity: 1,
        }),
      /productId does not match stock movement/
    );
  });

  it("rejects lot from another tenant", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.createLink({
          tenantId,
          stockMovementId,
          productId,
          lotId: otherTenantLotId,
          quantity: 1,
        }),
      /lotId is invalid/
    );
  });

  it("rejects lot that does not belong to the product", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.createLink({
          tenantId,
          stockMovementId,
          productId,
          lotId: otherProductLotId,
          quantity: 1,
        }),
      /lotId does not match productId/
    );
  });

  it("rejects quantity below or equal to zero", async () => {
    const context = buildService();

    await assert.rejects(
      () =>
        context.service.createLink({
          tenantId,
          stockMovementId,
          productId,
          quantity: 0,
        }),
      /quantity must be greater than zero/
    );
  });

  it("lists links by movement", async () => {
    const context = buildService([buildLink()]);

    const links = await context.service.findByMovement(
      tenantId,
      stockMovementId,
      adminActor
    );

    assert.equal(links.length, 1);
    assert.equal(links[0].stockMovementId, stockMovementId);
  });

  it("lists links by lot", async () => {
    const context = buildService([buildLink()]);

    const links = await context.service.findByLot(
      tenantId,
      lotId,
      adminActor
    );

    assert.equal(links.length, 1);
    assert.equal(links[0].lotId, lotId);
  });
});
