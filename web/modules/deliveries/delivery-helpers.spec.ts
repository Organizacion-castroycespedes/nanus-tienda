import assert from "node:assert/strict";
import test from "node:test";
import {
  filterDeliveriesByQuery,
  getDeliveryAvailableActions,
  isFinalDeliveryStatus,
} from "./delivery-helpers";
import type { DeliveryActionPermissionMap, DeliveryRecord } from "./types";

const allPermissions: DeliveryActionPermissionMap = {
  prepare: true,
  dispatch: true,
  "mark-delivered": true,
  "mark-not-delivered": true,
  cancel: true,
};

test("delivery actions follow allowed state transitions", () => {
  assert.deepEqual(getDeliveryAvailableActions("CREADO", allPermissions), [
    "prepare",
    "dispatch",
    "cancel",
  ]);
  assert.deepEqual(getDeliveryAvailableActions("EN_PREPARACION", allPermissions), [
    "dispatch",
    "cancel",
  ]);
  assert.deepEqual(getDeliveryAvailableActions("DESPACHADO", allPermissions), [
    "mark-delivered",
    "mark-not-delivered",
  ]);
  assert.deepEqual(getDeliveryAvailableActions("NO_ENTREGADO", allPermissions), [
    "dispatch",
  ]);
  assert.deepEqual(
    getDeliveryAvailableActions("NOT_DELIVERED", allPermissions, {
      metadata: { retry_allowed: false },
    }),
    []
  );
});

test("final delivery states have no actions", () => {
  assert.equal(isFinalDeliveryStatus("ENTREGADO"), true);
  assert.equal(isFinalDeliveryStatus("CANCELADO"), true);
  assert.deepEqual(getDeliveryAvailableActions("ENTREGADO", allPermissions), []);
  assert.deepEqual(getDeliveryAvailableActions("CANCELADO", allPermissions), []);
});

test("delivery actions respect permission map", () => {
  assert.deepEqual(
    getDeliveryAvailableActions("CREADO", {
      ...allPermissions,
      prepare: false,
    }),
    ["dispatch", "cancel"]
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
    status: "CREADO",
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
    dispatched_at: null,
    cancelled_at: null,
    delivered_at: null,
    failed_at: null,
  };

  assert.equal(filterDeliveriesByQuery([baseDelivery], "maria").length, 1);
  assert.equal(filterDeliveriesByQuery([baseDelivery], "300123").length, 1);
  assert.equal(filterDeliveriesByQuery([baseDelivery], "calle 10").length, 1);
  assert.equal(filterDeliveriesByQuery([baseDelivery], "no existe").length, 0);
});
