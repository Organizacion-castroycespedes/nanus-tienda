import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { DeliveriesReportsService } from "./deliveries-reports.service";
import type { DeliveryTicketDataset } from "./types/deliveries-report.types";

const deliveryId = "00000000-0000-0000-0000-000000000005";
const tenantId = "00000000-0000-0000-0000-000000000001";
const actor = {
  id: "00000000-0000-0000-0000-000000000003",
  tenantId,
  branchId: null,
  roles: ["ADMIN"],
};

const buildDataset = (
  overrides: Partial<DeliveryTicketDataset> = {}
): DeliveryTicketDataset => ({
  header: {
    deliveryId,
    deliveryNumber: "DOM-1",
    tenantName: "Manus POS",
    branchName: "Principal",
    status: "CREATED",
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:00:00.000Z",
    dispatchedAt: null,
    deliveredAt: null,
    failedAt: null,
    cancelledAt: null,
  },
  customer: {
    customerId: "00000000-0000-0000-0000-000000000007",
    name: "Cliente QA",
    phone: "3001234567",
    documentNumber: "123456",
  },
  address: {
    value: "Calle 1",
    reference: "Casa azul",
  },
  source: {
    orderId: "00000000-0000-0000-0000-000000000006",
    orderStatus: "CONFIRMED",
    orderDate: "2026-06-22T09:00:00.000Z",
    orderTotal: 12000,
    saleId: "00000000-0000-0000-0000-000000000008",
    saleStatus: "CONFIRMED",
    salePaymentStatus: "PAID",
    saleDate: "2026-06-22T09:30:00.000Z",
    saleTotal: 12000,
  },
  driver: {
    id: "00000000-0000-0000-0000-000000000010",
    name: "Carlos Repartidor",
    phone: "3007654321",
    documentNumber: "999",
    active: true,
  },
  payment: {
    methodId: "00000000-0000-0000-0000-000000000011",
    methodName: "Efectivo",
    methodType: "CASH",
  },
  totals: {
    deliveryFee: 5000,
    sourceSubtotal: 12000,
    total: 17000,
  },
  notes: "Sin timbre",
  createdByUserId: actor.id,
  updatedByUserId: actor.id,
  ...overrides,
});

const buildService = ({
  dataset,
  exists = true,
}: {
  dataset: DeliveryTicketDataset | null;
  exists?: boolean;
}) => {
  const calls: string[] = [];
  const adapter = {
    getDeliveryTicket: async () => {
      calls.push("getDeliveryTicket");
      return dataset;
    },
    deliveryExists: async () => {
      calls.push("deliveryExists");
      return exists;
    },
  };
  const pdfEngine = {
    generatePdf: async () => Buffer.from("delivery-ticket-pdf"),
  };

  return {
    service: new DeliveriesReportsService(adapter as never, pdfEngine as never),
    calls,
  };
};

test("DeliveriesReportsService returns ticket dataset with order sale and driver", async () => {
  const { service, calls } = buildService({ dataset: buildDataset() });

  const result = await service.getDeliveryTicket(deliveryId, actor);

  assert.equal(result.header.deliveryId, deliveryId);
  assert.equal(result.source.orderId, "00000000-0000-0000-0000-000000000006");
  assert.equal(result.source.saleId, "00000000-0000-0000-0000-000000000008");
  assert.equal(result.driver?.name, "Carlos Repartidor");
  assert.equal(result.totals.deliveryFee, 5000);
  assert.equal(result.totals.total, 17000);
  assert.deepEqual(calls, ["getDeliveryTicket"]);
});

test("DeliveriesReportsService supports ticket without driver", async () => {
  const { service } = buildService({ dataset: buildDataset({ driver: null }) });

  const result = await service.getDeliveryTicket(deliveryId, actor);

  assert.equal(result.driver, null);
  assert.equal(result.header.status, "CREATED");
});

test("DeliveriesReportsService rejects cross-tenant or missing delivery correctly", async () => {
  const forbidden = buildService({ dataset: null, exists: true });
  await assert.rejects(
    () => forbidden.service.getDeliveryTicket(deliveryId, actor),
    ForbiddenException
  );

  const missing = buildService({ dataset: null, exists: false });
  await assert.rejects(
    () => missing.service.getDeliveryTicket(deliveryId, actor),
    NotFoundException
  );
});

test("DeliveriesReportsService renders delivery ticket PDF through pdf engine", async () => {
  const { service } = buildService({ dataset: buildDataset() });

  const pdf = await service.getDeliveryTicketPdf(deliveryId, actor);

  assert.equal(Buffer.isBuffer(pdf), true);
  assert.equal(pdf.toString(), "delivery-ticket-pdf");
});
