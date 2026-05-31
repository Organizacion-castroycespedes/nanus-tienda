import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ElectronicInvoicingCustomersController } from "./electronic-invoicing-customers.controller";

const request = {
  user: {
    tenantId: "tenant-1",
  },
} as never;

describe("ElectronicInvoicingCustomersController", () => {
  it("routes list to service with tenant context", async () => {
    const service = {
      listCustomers: async (tenantId: string, query: unknown) => ({
        tenantId,
        query,
      }),
    };
    const controller = new ElectronicInvoicingCustomersController(
      service as never
    );

    const result = await controller.list({ search: "ACME" }, request);

    assert.deepEqual(result, {
      tenantId: "tenant-1",
      query: { search: "ACME" },
    });
  });

  it("routes create and ensure default to service", async () => {
    const calls: string[] = [];
    const service = {
      createCustomer: async () => {
        calls.push("create");
        return { id: "customer-1" };
      },
      ensureDefaultFinalConsumer: async () => {
        calls.push("ensure");
        return { id: "final-1" };
      },
    };
    const controller = new ElectronicInvoicingCustomersController(
      service as never
    );

    await controller.create({ name: "ACME" }, request);
    await controller.ensureDefault(request);

    assert.deepEqual(calls, ["create", "ensure"]);
  });
});
