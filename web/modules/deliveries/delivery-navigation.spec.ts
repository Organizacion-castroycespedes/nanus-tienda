import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeliveryFiltersFromSearchParams,
  buildDeliveryModuleHref,
} from "./delivery-navigation";

test("buildDeliveryModuleHref creates order filtered link", () => {
  assert.equal(
    buildDeliveryModuleHref("tenant-1", {
      sourceType: "order",
      sourceId: "order-1",
    }),
    "/tenant-1/deliveries?order_id=order-1"
  );
});

test("buildDeliveryModuleHref creates sale filtered link", () => {
  assert.equal(
    buildDeliveryModuleHref("tenant-1", {
      sourceType: "sale",
      sourceId: "sale-1",
    }),
    "/tenant-1/deliveries?sale_id=sale-1"
  );
});

test("buildDeliveryFiltersFromSearchParams reads supported relation filters", () => {
  assert.deepEqual(
    buildDeliveryFiltersFromSearchParams({
      status: "created",
      order_id: "order-1",
      sale_id: "sale-1",
      date_from: "2026-06-01",
      date_to: "2026-06-21",
    }),
    {
      query: "",
      status: "CREATED",
      orderId: "order-1",
      saleId: "sale-1",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-21",
    }
  );
});

test("buildDeliveryFiltersFromSearchParams ignores unsupported status", () => {
  assert.equal(
    buildDeliveryFiltersFromSearchParams({ status: "UNKNOWN" }).status,
    ""
  );
});
