import assert from "node:assert/strict";
import test from "node:test";
import { SaleItemEntity, type SaleItemProps } from "./sale-item.entity";

const ids = {
  tenant: "10000000-0000-0000-0000-000000000001",
  sale: "10000000-0000-0000-0000-000000000002",
  product: "10000000-0000-0000-0000-000000000003",
  item: "10000000-0000-0000-0000-000000000004",
};

const buildProps = (overrides: Partial<SaleItemProps> = {}): SaleItemProps => ({
  id: ids.item,
  tenantId: ids.tenant,
  saleId: ids.sale,
  productId: ids.product,
  quantity: 3,
  price: 100,
  priceWithoutTax: 100,
  taxTotal: 0,
  subtotal: 300,
  createdAt: new Date("2026-06-02T00:00:00.000Z"),
  ...overrides,
});

test("SaleItemEntity accepts legacy subtotal when price multiplied by quantity matches", () => {
  const item = SaleItemEntity.create(buildProps());

  assert.equal(item.subtotal, 300);
  assert.equal(item.pricingSource, null);
});

test("SaleItemEntity rejects legacy subtotal when price multiplied by quantity differs", () => {
  assert.throws(
    () => SaleItemEntity.create(buildProps({ subtotal: 300.01 })),
    /subtotal must equal price multiplied by quantity/
  );
});

test("SaleItemEntity accepts ORDER_ITEM_SNAPSHOT subtotal absorbed into lineTotal", () => {
  const item = SaleItemEntity.create(
    buildProps({
      quantity: 1,
      price: 33.33,
      priceWithoutTax: 28.01,
      taxTotal: 5.33,
      subtotal: 33.34,
      lineTotal: 33.34,
      pricingSource: "ORDER_ITEM_SNAPSHOT",
    })
  );

  assert.equal(item.subtotal, 33.34);
  assert.equal(item.lineTotal, 33.34);
  assert.equal(item.pricingSource, "ORDER_ITEM_SNAPSHOT");
});

test("SaleItemEntity rejects ORDER_ITEM_SNAPSHOT when lineTotal differs from subtotal", () => {
  assert.throws(
    () =>
      SaleItemEntity.create(
        buildProps({
          quantity: 1,
          price: 33.33,
          subtotal: 33.34,
          lineTotal: 33.33,
          pricingSource: "ORDER_ITEM_SNAPSHOT",
        })
      ),
    /lineTotal must equal subtotal for snapshot-priced sale item/
  );
});

test("SaleItemEntity compares legacy monetary values rounded to two decimals", () => {
  const item = SaleItemEntity.create(
    buildProps({
      quantity: 0.2,
      price: 0.1,
      priceWithoutTax: 0.1,
      subtotal: 0.02,
    })
  );

  assert.equal(item.subtotal, 0.02);
});
