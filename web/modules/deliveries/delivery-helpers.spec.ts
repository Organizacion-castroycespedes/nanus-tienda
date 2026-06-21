import assert from "node:assert/strict";
import test from "node:test";
import {
  filterDeliveriesByQuery,
  getDeliveryAvailableActions,
  isFinalDeliveryStatus,
} from "./delivery-helpers";
import type { DeliveryActionPermissionMap, DeliveryRecord } from "./types";

const allPermissions: DeliveryActionPermissionMap = {
  assign: true,
  dispatch: true,
  "mark-delivered": true,
  "mark-not-delivered": true,
  cancel: true,
};

test("delivery actions follow allowed state transitions", () => {
  assert.deepEqual(getDeliveryAvailableActions("CREATED", allPermissions), [
    "assign",
    "cancel",
  ]);
  assert.deepEqual(getDeliveryAvailableActions("ASSIGNED", allPermissions), [
    "dispatch",
    "cancel",
  ]);
  assert.deepEqual(getDeliveryAvailableActions("DISPATCHED", allPermissions), [
    "mark-delivered",
    "mark-not-delivered",
  ]);
});

test("final delivery states have no actions", () => {
  assert.equal(isFinalDeliveryStatus("DELIVERED"), true);
  assert.deepEqual(getDeliveryAvailableActions("DELIVERED", allPermissions), []);
  assert.deepEqual(getDeliveryAvailableActions("NOT_DELIVERED", allPermissions), []);
  assert.deepEqual(getDeliveryAvailableActions("CANCELLED", allPermissions), []);
});

test("delivery actions respect permission map", () => {
  assert.deepEqual(
    getDeliveryAvailableActions("CREATED", {
      ...allPermissions,
      assign: false,
    }),
    ["cancel"]
  );
});

test("local delivery query filters contact phone and address", () => {
  const baseDelivery: DeliveryRecord = {
    id: "delivery-1",
    tenant_id: "tenant-1",
    branch_id: "branch-1",
    customer_id: null,
    order_id: null,
    sale_id: null,
    delivery_number: "D-001",
    status: "CREATED",
    customer_name: "Maria Perez",
    customer_phone: "3001234567",
    delivery_address: "Calle 10 # 20-30",
    delivery_reference: null,
    delivery_fee: 0,
    subtotal: 0,
    total: 0,
    payment_method_id: null,
    assigned_courier_id: null,
    notes: null,
    metadata: {},
    created_by_user_id: null,
    updated_by_user_id: null,
    created_at: "2026-06-21T10:00:00.000Z",
    updated_at: "2026-06-21T10:00:00.000Z",
    cancelled_at: null,
    delivered_at: null,
  };

  assert.equal(filterDeliveriesByQuery([baseDelivery], "maria").length, 1);
  assert.equal(filterDeliveriesByQuery([baseDelivery], "300123").length, 1);
  assert.equal(filterDeliveriesByQuery([baseDelivery], "calle 10").length, 1);
  assert.equal(filterDeliveriesByQuery([baseDelivery], "no existe").length, 0);
});
