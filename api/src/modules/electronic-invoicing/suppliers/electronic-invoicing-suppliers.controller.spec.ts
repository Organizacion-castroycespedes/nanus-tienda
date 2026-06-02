import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "reflect-metadata";
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { PERMISSION_KEY } from "../../../common/decorators/require-permission.decorator";
import { ElectronicInvoicingSuppliersController } from "./electronic-invoicing-suppliers.controller";

const request = {
  user: {
    tenantId: "tenant-1",
  },
} as never;

describe("ElectronicInvoicingSuppliersController", () => {
  it("uses the suppliers electronic invoicing permission key", () => {
    const listPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      ElectronicInvoicingSuppliersController.prototype.list
    );
    const createPermission = Reflect.getMetadata(
      PERMISSION_KEY,
      ElectronicInvoicingSuppliersController.prototype.create
    );
    const updatePermission = Reflect.getMetadata(
      PERMISSION_KEY,
      ElectronicInvoicingSuppliersController.prototype.update
    );

    assert.deepEqual(listPermission, {
      menuKey: MENU_KEYS.ELECTRONIC_INVOICING_SUPPLIERS,
      level: "READ",
    });
    assert.deepEqual(createPermission, {
      menuKey: MENU_KEYS.ELECTRONIC_INVOICING_SUPPLIERS,
      level: "WRITE",
    });
    assert.deepEqual(updatePermission, {
      menuKey: MENU_KEYS.ELECTRONIC_INVOICING_SUPPLIERS,
      level: "WRITE",
    });
  });

  it("routes list to service with tenant context", async () => {
    const service = {
      listSuppliers: async (tenantId: string, query: unknown) => ({
        tenantId,
        query,
      }),
    };
    const controller = new ElectronicInvoicingSuppliersController(
      service as never
    );

    const result = await controller.list({ search: "Proveedor" }, request);

    assert.deepEqual(result, {
      tenantId: "tenant-1",
      query: { search: "Proveedor" },
    });
  });

  it("routes create and update to service", async () => {
    const calls: string[] = [];
    const service = {
      createSupplier: async () => {
        calls.push("create");
        return { id: "supplier-1" };
      },
      updateSupplier: async () => {
        calls.push("update");
        return { id: "supplier-1" };
      },
    };
    const controller = new ElectronicInvoicingSuppliersController(
      service as never
    );

    await controller.create({ name: "Proveedor" }, request);
    await controller.update("supplier-1", { legalName: "Proveedor SAS" }, request);

    assert.deepEqual(calls, ["create", "update"]);
  });
});
