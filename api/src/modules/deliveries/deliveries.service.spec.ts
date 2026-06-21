import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { DeliveriesService } from "./deliveries.service";
import { DeliveryStateMachineService } from "./services/delivery-state-machine.service";

const tenantId = "00000000-0000-0000-0000-000000000001";
const branchId = "00000000-0000-0000-0000-000000000002";
const actorUserId = "00000000-0000-0000-0000-000000000003";
const courierId = "00000000-0000-0000-0000-000000000004";
const deliveryId = "00000000-0000-0000-0000-000000000005";

const actor = {
  tenantId,
  userId: actorUserId,
  roles: ["ADMIN"],
};

const buildDelivery = (overrides: Record<string, unknown> = {}) => ({
  id: deliveryId,
  tenant_id: tenantId,
  branch_id: branchId,
  customer_id: null,
  order_id: null,
  sale_id: null,
  delivery_number: "DOM-TEST",
  status: "CREATED",
  customer_name: "Cliente prueba",
  customer_phone: "3000000000",
  delivery_address: "Calle prueba 123",
  delivery_reference: null,
  delivery_fee: "0",
  subtotal: "0",
  total: "0",
  payment_method_id: null,
  assigned_courier_id: null,
  notes: null,
  metadata: {},
  created_by_user_id: actorUserId,
  updated_by_user_id: actorUserId,
  created_at: "2026-06-20T00:00:00.000Z",
  updated_at: "2026-06-20T00:00:00.000Z",
  cancelled_at: null,
  delivered_at: null,
  ...overrides,
});

const buildHarness = (initialDelivery: Record<string, unknown>) => {
  const queries: string[] = [];
  const historyParams: unknown[][] = [];
  let released = false;
  let rolledBack = false;
  let committed = false;

  const client = {
    query: async (queryText: string, params: unknown[] = []) => {
      queries.push(queryText);

      if (queryText === "BEGIN") {
        return { rows: [] };
      }
      if (queryText === "COMMIT") {
        committed = true;
        return { rows: [] };
      }
      if (queryText === "ROLLBACK") {
        rolledBack = true;
        return { rows: [] };
      }
      if (queryText.includes("FROM public.deliveries") && queryText.includes("FOR UPDATE")) {
        return { rows: [initialDelivery] };
      }
      if (queryText.includes("UPDATE public.deliveries")) {
        const nextStatus = params[0] as string;
        const updated = {
          ...initialDelivery,
          status: nextStatus,
          updated_by_user_id: params[1],
          assigned_courier_id:
            nextStatus === "ASSIGNED" ? params[2] : initialDelivery.assigned_courier_id,
          delivered_at:
            nextStatus === "DELIVERED" ? params[2] : initialDelivery.delivered_at,
          cancelled_at:
            nextStatus === "CANCELLED" ? params[2] : initialDelivery.cancelled_at,
        };
        return { rows: [updated] };
      }
      if (queryText.includes("INSERT INTO public.delivery_status_history")) {
        historyParams.push(params);
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${queryText}`);
    },
    release: () => {
      released = true;
    },
  };

  const db = {
    query: async () => ({ rows: [{ id: courierId }] }),
    getClient: async () => client,
  };

  const service = new DeliveriesService(
    db as never,
    {} as never,
    new DeliveryStateMachineService()
  );

  return {
    service,
    get committed() {
      return committed;
    },
    get rolledBack() {
      return rolledBack;
    },
    get released() {
      return released;
    },
    historyParams,
    queries,
  };
};

test("DeliveriesService.assign updates status and writes history transactionally", async () => {
  const harness = buildHarness(buildDelivery());

  const result = await harness.service.assign(
    deliveryId,
    { assigned_courier_id: courierId },
    actor
  );

  assert.equal(result.status, "ASSIGNED");
  assert.equal(result.assigned_courier_id, courierId);
  assert.equal(harness.committed, true);
  assert.equal(harness.rolledBack, false);
  assert.equal(harness.released, true);
  assert.equal(harness.historyParams.length, 1);
  assert.deepEqual(harness.historyParams[0].slice(0, 5), [
    deliveryId,
    "CREATED",
    "ASSIGNED",
    actorUserId,
    null,
  ]);
});

test("DeliveriesService dispatch delivered not-delivered and cancel valid flows", async () => {
  const assigned = buildHarness(
    buildDelivery({ status: "ASSIGNED", assigned_courier_id: courierId })
  );
  const dispatched = await assigned.service.dispatch(deliveryId, {}, actor);
  assert.equal(dispatched.status, "DISPATCHED");
  assert.equal(assigned.historyParams[0][2], "DISPATCHED");

  const delivered = buildHarness(
    buildDelivery({ status: "DISPATCHED", assigned_courier_id: courierId })
  );
  const deliveredResult = await delivered.service.markDelivered(
    deliveryId,
    { received_by: "Cliente prueba" },
    actor
  );
  assert.equal(deliveredResult.status, "DELIVERED");
  assert.equal(delivered.historyParams[0][2], "DELIVERED");

  const notDelivered = buildHarness(
    buildDelivery({ status: "DISPATCHED", assigned_courier_id: courierId })
  );
  const notDeliveredResult = await notDelivered.service.markNotDelivered(
    deliveryId,
    { reason: "No estaba en casa" },
    actor
  );
  assert.equal(notDeliveredResult.status, "NOT_DELIVERED");
  assert.equal(notDelivered.historyParams[0][4], "No estaba en casa");

  const cancel = buildHarness(buildDelivery());
  const cancelResult = await cancel.service.cancel(
    deliveryId,
    { reason: "Cliente cancela" },
    actor
  );
  assert.equal(cancelResult.status, "CANCELLED");
  assert.equal(cancel.historyParams[0][4], "Cliente cancela");
});

test("DeliveriesService rejects invalid state changes and rolls back", async () => {
  const dispatchWithoutCourier = buildHarness(buildDelivery({ status: "ASSIGNED" }));
  await assert.rejects(
    () => dispatchWithoutCourier.service.dispatch(deliveryId, {}, actor),
    BadRequestException
  );
  assert.equal(dispatchWithoutCourier.committed, false);
  assert.equal(dispatchWithoutCourier.rolledBack, true);
  assert.equal(dispatchWithoutCourier.historyParams.length, 0);

  const deliveredWithoutDispatch = buildHarness(
    buildDelivery({ status: "ASSIGNED", assigned_courier_id: courierId })
  );
  await assert.rejects(
    () => deliveredWithoutDispatch.service.markDelivered(deliveryId, {}, actor),
    BadRequestException
  );
  assert.equal(deliveredWithoutDispatch.rolledBack, true);
  assert.equal(deliveredWithoutDispatch.historyParams.length, 0);

  const cancelDelivered = buildHarness(
    buildDelivery({ status: "DELIVERED", assigned_courier_id: courierId })
  );
  await assert.rejects(
    () => cancelDelivered.service.cancel(deliveryId, { reason: "No" }, actor),
    BadRequestException
  );
  assert.equal(cancelDelivered.rolledBack, true);
  assert.equal(cancelDelivered.historyParams.length, 0);
});
