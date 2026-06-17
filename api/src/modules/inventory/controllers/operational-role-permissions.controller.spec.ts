import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "reflect-metadata";
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { PERMISSION_KEY } from "../../../common/decorators/require-permission.decorator";
import { ROLES_KEY } from "../../../common/decorators/roles.decorator";
import { PromotionsController } from "../../pricing/promotions.controller";
import { CustomerController } from "./customer.controller";
import { InventoryLocationController } from "./inventory-location.controller";
import { InventoryLotController } from "./inventory-lot.controller";
import { ProductBarcodeController } from "./product-barcode.controller";
import { ProductCategoryController } from "./product-category.controller";
import { ProductController } from "./product.controller";
import { ProductSubcategoryController } from "./product-subcategory.controller";
import { PurchaseController } from "./purchase.controller";
import { SupplierController } from "./supplier.controller";
import { StockAdjustmentController } from "./stock-adjustment.controller";
import { TaxController } from "./tax.controller";
import { UnitController } from "./unit.controller";

const adminWriteRoles = ["SUPER_ADMIN", "SUPER_USER", "ADMIN"];
const operationalRoles = ["USER", "ADMIN", "SUPER_USER"];

type ControllerMethod = {
  controller: string;
  prototype: object;
  methods: string[];
};

const getMethodRoles = (prototype: object, methodName: string) => {
  const method = (prototype as Record<string, unknown>)[methodName];
  assert.equal(typeof method, "function", `${methodName} must be a method`);
  return (
    (Reflect.getMetadata(ROLES_KEY, method) as string[] | undefined) ??
    (Reflect.getMetadata(
      ROLES_KEY,
      (prototype as { constructor: unknown }).constructor
    ) as string[] | undefined)
  );
};

const getMethodPermission = (prototype: object, methodName: string) => {
  const method = (prototype as Record<string, unknown>)[methodName];
  assert.equal(typeof method, "function", `${methodName} must be a method`);
  return Reflect.getMetadata(PERMISSION_KEY, method) as
    | { menuKey: string; level: string; operationalRoles?: string[] }
    | undefined;
};

describe("operational catalog role permissions", () => {
  it("allows ADMIN write operations for purchases, catalogs and promotions without allowing USER writes", () => {
    const controllers: ControllerMethod[] = [
      {
        controller: "PurchaseController",
        prototype: PurchaseController.prototype,
        methods: ["create", "update", "receive", "cancel", "settlePartial"],
      },
      {
        controller: "ProductController",
        prototype: ProductController.prototype,
        methods: ["create", "changePrice", "update", "remove"],
      },
      {
        controller: "ProductBarcodeController",
        prototype: ProductBarcodeController.prototype,
        methods: ["create", "update", "deactivate", "setPrimary"],
      },
      {
        controller: "ProductCategoryController",
        prototype: ProductCategoryController.prototype,
        methods: ["create", "update", "activate", "deactivate"],
      },
      {
        controller: "ProductSubcategoryController",
        prototype: ProductSubcategoryController.prototype,
        methods: ["create", "update", "activate", "deactivate"],
      },
      {
        controller: "StockAdjustmentController",
        prototype: StockAdjustmentController.prototype,
        methods: ["create"],
      },
      {
        controller: "InventoryLocationController",
        prototype: InventoryLocationController.prototype,
        methods: ["create", "update", "deactivate"],
      },
      {
        controller: "InventoryLotController",
        prototype: InventoryLotController.prototype,
        methods: ["create", "update", "block", "cancel"],
      },
      {
        controller: "UnitController",
        prototype: UnitController.prototype,
        methods: ["create", "update", "remove"],
      },
      {
        controller: "TaxController",
        prototype: TaxController.prototype,
        methods: ["create", "update", "remove"],
      },
      {
        controller: "SupplierController",
        prototype: SupplierController.prototype,
        methods: ["create", "update", "remove"],
      },
      {
        controller: "PromotionsController",
        prototype: PromotionsController.prototype,
        methods: ["create", "update", "deactivate"],
      },
    ];

    for (const item of controllers) {
      for (const methodName of item.methods) {
        const roles = getMethodRoles(item.prototype, methodName);
        assert.deepEqual(
          roles,
          adminWriteRoles,
          `${item.controller}.${methodName} write roles must match`
        );
        assert.equal(
          roles?.includes("USER"),
          false,
          `${item.controller}.${methodName} must not allow USER writes`
        );
      }
    }
  });

  it("uses dedicated menu keys for units and taxes instead of generic inventory permission", () => {
    for (const methodName of ["list", "create", "update", "remove"]) {
      const unitPermission = getMethodPermission(UnitController.prototype, methodName);
      assert.equal(
        unitPermission?.menuKey,
        MENU_KEYS.INVENTORY_UNITS,
        `UnitController.${methodName} must use INVENTORY_UNITS`
      );
      assert.notEqual(unitPermission?.menuKey, "INVENTORY");

      const taxPermission = getMethodPermission(TaxController.prototype, methodName);
      assert.equal(
        taxPermission?.menuKey,
        MENU_KEYS.INVENTORY_TAXES,
        `TaxController.${methodName} must use INVENTORY_TAXES`
      );
      assert.notEqual(taxPermission?.menuKey, "INVENTORY");
    }
  });

  it("marks customer create and update as operational writes", () => {
    for (const methodName of ["create", "list", "getById", "update"]) {
      const permission = getMethodPermission(CustomerController.prototype, methodName);
      assert.equal(
        permission?.menuKey,
        "CUSTOMERS",
        `CustomerController.${methodName} must use CUSTOMERS`
      );
      assert.deepEqual(
        permission?.operationalRoles,
        operationalRoles,
        `CustomerController.${methodName} must allow operational roles`
      );
    }

    const removeRoles = getMethodRoles(CustomerController.prototype, "remove");
    assert.equal(removeRoles?.includes("USER"), false);
  });

  it("marks POS/Orders catalog reads as operational reads without opening writes", () => {
    for (const methodName of ["list", "getById", "getPriceHistory"]) {
      const permission = getMethodPermission(ProductController.prototype, methodName);
      assert.equal(permission?.menuKey, MENU_KEYS.INVENTORY_PRODUCTS);
      assert.equal(permission?.level, "READ");
      assert.deepEqual(permission?.operationalRoles, operationalRoles);
    }

    const barcodePermission = getMethodPermission(
      ProductBarcodeController.prototype,
      "list"
    );
    assert.equal(barcodePermission?.menuKey, MENU_KEYS.INVENTORY_PRODUCTS);
    assert.equal(barcodePermission?.level, "READ");
    assert.deepEqual(barcodePermission?.operationalRoles, operationalRoles);

    const taxPermission = getMethodPermission(TaxController.prototype, "list");
    assert.equal(taxPermission?.menuKey, MENU_KEYS.INVENTORY_TAXES);
    assert.equal(taxPermission?.level, "READ");
    assert.deepEqual(taxPermission?.operationalRoles, operationalRoles);

    for (const methodName of ["create", "changePrice", "update", "remove"]) {
      const roles = getMethodRoles(ProductController.prototype, methodName);
      assert.equal(roles?.includes("USER"), false);
    }
    for (const methodName of ["create", "update", "activate", "deactivate"]) {
      const categoryRoles = getMethodRoles(
        ProductCategoryController.prototype,
        methodName
      );
      const subcategoryRoles = getMethodRoles(
        ProductSubcategoryController.prototype,
        methodName
      );
      assert.equal(categoryRoles?.includes("USER"), false);
      assert.equal(subcategoryRoles?.includes("USER"), false);
    }
    for (const methodName of ["create", "update", "remove"]) {
      const roles = getMethodRoles(TaxController.prototype, methodName);
      assert.equal(roles?.includes("USER"), false);
    }
  });

  it("protects product classification controllers with product-equivalent permissions", () => {
    for (const methodName of ["list", "getById"]) {
      const categoryPermission = getMethodPermission(
        ProductCategoryController.prototype,
        methodName
      );
      assert.equal(categoryPermission?.menuKey, MENU_KEYS.INVENTORY_PRODUCTS);
      assert.equal(categoryPermission?.level, "READ");
      assert.deepEqual(categoryPermission?.operationalRoles, operationalRoles);

      const subcategoryPermission = getMethodPermission(
        ProductSubcategoryController.prototype,
        methodName
      );
      assert.equal(subcategoryPermission?.menuKey, MENU_KEYS.INVENTORY_PRODUCTS);
      assert.equal(subcategoryPermission?.level, "READ");
      assert.deepEqual(subcategoryPermission?.operationalRoles, operationalRoles);
    }

    for (const methodName of ["create", "update", "activate", "deactivate"]) {
      const categoryPermission = getMethodPermission(
        ProductCategoryController.prototype,
        methodName
      );
      assert.equal(categoryPermission?.menuKey, MENU_KEYS.INVENTORY_PRODUCTS);
      assert.equal(categoryPermission?.level, "WRITE");

      const subcategoryPermission = getMethodPermission(
        ProductSubcategoryController.prototype,
        methodName
      );
      assert.equal(subcategoryPermission?.menuKey, MENU_KEYS.INVENTORY_PRODUCTS);
      assert.equal(subcategoryPermission?.level, "WRITE");
    }
  });

  it("keeps promotions admin-only at route level", () => {
    for (const methodName of ["list", "getById", "create", "update", "deactivate"]) {
      const roles = getMethodRoles(PromotionsController.prototype, methodName);
      assert.deepEqual(
        roles,
        adminWriteRoles,
        `PromotionsController.${methodName} roles must be admin-only`
      );
      assert.equal(
        roles?.includes("USER"),
        false,
        `PromotionsController.${methodName} must not allow USER`
      );
    }
  });
});
