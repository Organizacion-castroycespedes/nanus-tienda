import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "reflect-metadata";
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { PERMISSION_KEY } from "../../../common/decorators/require-permission.decorator";
import { ElectronicInvoicingCustomersController } from "./electronic-invoicing-customers.controller";

const request = {
  user: {
    tenantId: "tenant-1",
  },
} as never;

describe("ElectronicInvoicingCustomersController", () => {
  it("keeps the customers electronic invoicing permission key", () => {
    const listPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      ElectronicInvoicingCustomersController.prototype.list
    );
    const createPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      ElectronicInvoicingCustomersController.prototype.create
    );
    const updatePermission = Reflect.getMetadata(
      PERMISSION_KEY,
      ElectronicInvoicingCustomersController.prototype.update
    );
    const lookupPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      ElectronicInvoicingCustomersController.prototype.lookup
    );
    const applyLookupPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      ElectronicInvoicingCustomersController.prototype.applyLookup
    );
    const getDefaultPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      ElectronicInvoicingCustomersController.prototype.getDefault
    );
    const ensureDefaultPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      ElectronicInvoicingCustomersController.prototype.ensureDefault
    );
    const getByIdPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      ElectronicInvoicingCustomersController.prototype.getById
    );

    assert.deepEqual(listPermission, {
      menuKey: MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS,
      level: "READ",
    });
    assert.deepEqual(createPermission, {
      menuKey: [MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS, "POS"],
      level: "WRITE",
    });
    assert.deepEqual(updatePermission, {
      menuKey: MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS,
      level: "WRITE",
    });
    assert.deepEqual(lookupPermission, {
      menuKey: [MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS, "POS"],
      level: "READ",
    });
    assert.deepEqual(applyLookupPermission, {
      menuKey: [MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS, "POS"],
      level: "WRITE",
    });
    assert.deepEqual(getDefaultPermission, {
      menuKey: MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS,
      level: "READ",
    });
    assert.deepEqual(ensureDefaultPermission, {
      menuKey: MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS,
      level: "WRITE",
    });
    assert.deepEqual(getByIdPermission, {
      menuKey: MENU_KEYS.ELECTRONIC_INVOICING_CUSTOMERS,
      level: "READ",
    });
  });

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

  it("routes create, detail and ensure default to service", async () => {
    const calls: string[] = [];
    const service = {
      createCustomer: async () => {
        calls.push("create");
        return { id: "customer-1" };
      },
      getCustomer: async () => {
        calls.push("detail");
        return { id: "customer-1" };
      },
      lookupCustomerFiscalData: async () => {
        calls.push("lookup");
        return { lookupStatus: "FOUND" };
      },
      applyCustomerLookup: async () => {
        calls.push("apply-lookup");
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
    await controller.getById("customer-1", request);
    await controller.lookup(
      { documentTypeCode: "31", documentNumber: "900123456" },
      request
    );
    await controller.applyLookup(
      "customer-1",
      { documentTypeCode: "31", documentNumber: "900123456" },
      request
    );
    await controller.ensureDefault(request);

    assert.deepEqual(calls, [
      "create",
      "detail",
      "lookup",
      "apply-lookup",
      "ensure",
    ]);
  });
});
