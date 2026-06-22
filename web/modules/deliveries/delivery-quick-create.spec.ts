import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeliveryQuickCreatePayload,
  filterCustomersForDelivery,
  getSourceTotals,
  resolveDeliveryBranch,
  validateDeliveryQuickCreate,
} from "./delivery-quick-create";

test("filterCustomersForDelivery matches visible customer fields", () => {
  const customers = [
    {
      id: "customer-1",
      name: "Maria Perez",
      documentNumber: "123",
      phone: "3001234567",
      email: "maria@example.com",
      isActive: true,
    },
    {
      id: "customer-2",
      name: "Cliente Inactivo",
      documentNumber: "999",
      phone: null,
      email: null,
      isActive: false,
    },
  ];

  assert.equal(filterCustomersForDelivery(customers, "maria").length, 1);
  assert.equal(filterCustomersForDelivery(customers, "300123")[0].id, "customer-1");
  assert.equal(filterCustomersForDelivery(customers, "999").length, 0);
});

test("resolveDeliveryBranch follows context priority", () => {
  const branches = [
    { id: "branch-auth", nombre: "Centro", estado: "ACTIVE" },
    { id: "branch-pos", nombre: "Norte", estado: "ACTIVE" },
  ];

  assert.deepEqual(
    resolveDeliveryBranch({
      posBranchId: "branch-pos",
      authBranchId: "branch-auth",
      branches,
    }),
    { branchId: "branch-pos", source: "pos" }
  );

  assert.deepEqual(
    resolveDeliveryBranch({
      posBranchId: null,
      authBranchId: "branch-auth",
      branches,
    }),
    { branchId: "branch-auth", source: "auth" }
  );

  assert.deepEqual(
    resolveDeliveryBranch({
      posBranchId: null,
      authBranchId: null,
      branches: [{ id: "branch-only", nombre: "Unica", estado: "ACTIVE" }],
    }),
    { branchId: "branch-only", source: "single" }
  );
});

test("getSourceTotals mirrors source total into subtotal and total", () => {
  assert.deepEqual(getSourceTotals(12500), {
    subtotal: "12500",
    total: "12500",
  });
});

test("validateDeliveryQuickCreate returns non-technical messages", () => {
  assert.equal(
    validateDeliveryQuickCreate({
      branchId: "",
      customerId: "",
      customerName: "",
      customerPhone: "",
      deliveryAddress: "",
      deliveryFee: "",
    }),
    "Selecciona una sucursal para el domicilio."
  );

  assert.equal(
    validateDeliveryQuickCreate({
      branchId: "branch-1",
      customerId: "",
      customerName: "",
      customerPhone: "",
      deliveryAddress: "Calle 1",
      deliveryFee: "",
    }),
    "Selecciona un cliente o escribe el contacto."
  );

  assert.equal(
    validateDeliveryQuickCreate({
      branchId: "branch-1",
      customerId: "customer-1",
      customerName: "Maria Perez",
      customerPhone: "",
      deliveryAddress: "Calle 1",
      deliveryFee: "",
    }),
    "Escribe el telefono de contacto."
  );
});

test("buildDeliveryQuickCreatePayload maps visible choices to API fields", () => {
  const payload = buildDeliveryQuickCreatePayload({
    branchId: "branch-1",
    customerId: "customer-1",
    orderId: "order-1",
    saleId: "",
    driverId: "driver-1",
    customerName: "Maria Perez",
    customerPhone: "3001234567",
    deliveryAddress: "Calle 1",
    deliveryReference: "Casa azul",
    deliveryFee: "2500",
    subtotal: "10000",
    total: "12500",
    paymentMethodId: "payment-1",
    notes: "Sin timbre",
  });

  assert.equal(payload.branch_id, "branch-1");
  assert.equal(payload.customer_id, "customer-1");
  assert.equal(payload.order_id, "order-1");
  assert.equal(payload.driver_id, "driver-1");
  assert.equal(payload.payment_method_id, "payment-1");
  assert.equal(payload.delivery_fee, 2500);
  assert.equal(payload.metadata?.no_cash_integration, true);
});
