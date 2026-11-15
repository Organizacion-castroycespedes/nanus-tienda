import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import ExcelJS from "exceljs";
import { HttpException } from "@nestjs/common";
import { PERMISSION_KEY } from "../../../common/decorators/require-permission.decorator";
import { ProductSerialController } from "./product-serial.controller";
import { mapSerialDatabaseError, SERIAL_ERROR_CODES } from "./product-serial.errors";
import { normalizeSerialNumber, parseSerialText } from "./product-serial.normalize";
import { normalizeSerialInputs, ProductSerialService } from "./product-serial.service";
import type { ProductSerialRow } from "./product-serial.repository";

const tenantId = "00000000-0000-0000-0000-0000000000a1";
const branchA = "00000000-0000-0000-0000-0000000000b1";
const branchB = "00000000-0000-0000-0000-0000000000b2";
const serialProduct = "00000000-0000-0000-0000-0000000000f1";
const plainProduct = "00000000-0000-0000-0000-0000000000f2";
const userId = "00000000-0000-0000-0000-0000000000e1";

const admin = { roles: ["ADMIN"], userId, tenantId };
const superUser = { roles: ["SUPER_USER"], userId, tenantId };

const serialRow = (overrides: Partial<ProductSerialRow> = {}): ProductSerialRow => ({
  id: "00000000-0000-0000-0000-000000000501",
  product_id: serialProduct,
  product_name: "Aire LG 12000",
  product_sku: "LGAC12",
  branch_id: branchA,
  branch_name: "Principal",
  location_id: null,
  location_code: null,
  location_name: null,
  serial_number: "lgac-0001",
  serial_number_normalized: "LGAC-0001",
  status: "AVAILABLE",
  source_type: "PURCHASE",
  purchase_id: null,
  sale_id: null,
  order_id: null,
  customer_id: null,
  received_at: new Date("2026-11-14T10:00:00.000Z"),
  sold_at: null,
  total_count: 1,
  ...overrides,
});

const buildService = (options: { accessibleBranches?: string[]; registered?: string[]; others?: string[] } = {}) => {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, value: unknown) => {
    calls[name] = [...(calls[name] ?? []), value];
  };
  const repository = {
    findProduct: async (_tenant: string, productId: string) =>
      productId === serialProduct
        ? { id: serialProduct, name: "Aire LG 12000", sku: "LGAC12", requires_serial: true }
        : productId === plainProduct
          ? { id: plainProduct, name: "Cable", sku: "CAB", requires_serial: false }
          : null,
    branchBelongsToTenant: async (_tenant: string, branchId: string) => [branchA, branchB].includes(branchId),
    findRegistered: async (_t: string, _p: string, normalized: string[]) =>
      normalized
        .filter((serial) => (options.registered ?? []).includes(serial))
        .map((serial) => ({ serial_number_normalized: serial, status: "SOLD" as const })),
    findInOtherProducts: async (_t: string, _p: string, normalized: string[]) =>
      normalized
        .filter((serial) => (options.others ?? []).includes(serial))
        .map((serial) => ({ serial_number_normalized: serial, product_name: "Nevera", product_sku: "NEV" })),
    listByProduct: async (input: unknown) => {
      record("listByProduct", input);
      return [serialRow()];
    },
    findBySerialNumber: async (input: unknown) => {
      record("findBySerialNumber", input);
      return [serialRow()];
    },
    search: async (input: unknown) => {
      record("search", input);
      return [];
    },
    findById: async (_t: string, id: string) => (id === "missing" ? null : serialRow({ branch_id: branchB })),
    findEvents: async () => [],
  };
  const financeAccess = {
    findAccessibleBranchIds: async () => options.accessibleBranches ?? [branchA],
  };
  return { service: new ProductSerialService(repository as never, financeAccess as never), calls };
};

test("ProductSerialService.prevalidate clasifica formato, duplicados, registradas y otro producto", async () => {
  const { service } = buildService({ registered: ["LGAC-0003"], others: ["LGAC-0004"] });

  const result = await service.prevalidate(
    tenantId,
    {
      productId: serialProduct,
      branchId: branchA,
      serialNumbers: ["lgac-0001", "LGAC-0001 ", "lgac 02", "LGAC-0003", "LGAC-0004", "LGAC-0005"],
    },
    admin
  );

  assert.deepEqual(result.invalidFormat, ["lgac 02"]);
  assert.deepEqual(result.duplicatesInPayload, ["LGAC-0001"]);
  assert.deepEqual(result.alreadyRegistered, [{ serialNumber: "LGAC-0003", status: "SOLD" }]);
  assert.deepEqual(result.existsInOtherProduct, [
    { serialNumber: "LGAC-0004", productName: "Nevera", productSku: "NEV" },
  ]);
  assert.deepEqual(result.valid, ["LGAC-0004", "LGAC-0005"]);
  assert.equal(result.total, 6);
  assert.equal(result.ok, false);
});

test("ProductSerialService.prevalidate: carga limpia queda ok aunque exista en otro producto", async () => {
  const { service } = buildService({ others: ["LGAC-0002"] });

  const result = await service.prevalidate(
    tenantId,
    { productId: serialProduct, branchId: branchA, serialNumbers: ["LGAC-0001", "LGAC-0002"] },
    admin
  );

  assert.equal(result.ok, true);
  assert.equal(result.existsInOtherProduct.length, 1);
});

test("ProductSerialService.prevalidate rechaza producto sin serie, sucursal ajena y listas inválidas", async () => {
  const { service } = buildService({ accessibleBranches: [branchA] });

  await assert.rejects(
    () => service.prevalidate(tenantId, { productId: plainProduct, branchId: branchA, serialNumbers: ["X1"] }, admin),
    /no maneja número de serie/
  );
  await assert.rejects(
    () => service.prevalidate(tenantId, { productId: serialProduct, branchId: branchB, serialNumbers: ["X1"] }, admin),
    /not authorized for this branch/
  );
  await assert.rejects(
    () => service.prevalidate(tenantId, { productId: serialProduct, branchId: branchA, serialNumbers: "X1" }, admin),
    /serialNumbers debe ser una lista/
  );
  await assert.rejects(
    () =>
      service.prevalidate(
        tenantId,
        { productId: serialProduct, branchId: branchA, serialNumbers: Array.from({ length: 2001 }, (_, i) => `S${i}`) },
        admin
      ),
    /Máximo 2000 series/
  );
});

test("ProductSerialService.prevalidate permite cualquier sucursal del tenant a SUPER_USER", async () => {
  const { service } = buildService({ accessibleBranches: [] });

  const result = await service.prevalidate(
    tenantId,
    { productId: serialProduct, branchId: branchB, serialNumbers: ["LGAC-0009"] },
    superUser
  );

  assert.equal(result.ok, true);
});

test("ProductSerialService.parseFile lee CSV con encabezado y separadores", async () => {
  const { service } = buildService();

  const result = await service.parseFile({
    originalname: "series.csv",
    buffer: Buffer.from("﻿Número de serie;Modelo\r\nLGAC-0001;12000\r\n\r\n\"LGAC-0002\",x\r\nLGAC-0003\n"),
  });

  assert.deepEqual(result.serialNumbers, ["LGAC-0001", "LGAC-0002", "LGAC-0003"]);
});

test("ProductSerialService.parseFile lee XLSX por columna serie o por la primera columna", async () => {
  const { service } = buildService();
  const withHeader = new ExcelJS.Workbook();
  const sheetA = withHeader.addWorksheet("Series");
  sheetA.addRow(["Modelo", "Serie"]);
  sheetA.addRow(["12000", "LGAC-0001"]);
  sheetA.addRow(["12000", 12345]);
  const withoutHeader = new ExcelJS.Workbook();
  const sheetB = withoutHeader.addWorksheet("Hoja1");
  sheetB.addRow(["LGAC-0010"]);
  sheetB.addRow(["LGAC-0011"]);

  const first = await service.parseFile({
    originalname: "series.xlsx",
    buffer: Buffer.from(await withHeader.xlsx.writeBuffer()),
  });
  const second = await service.parseFile({
    originalname: "SERIES.XLSX",
    buffer: Buffer.from(await withoutHeader.xlsx.writeBuffer()),
  });

  assert.deepEqual(first.serialNumbers, ["LGAC-0001", "12345"]);
  assert.deepEqual(second.serialNumbers, ["LGAC-0010", "LGAC-0011"]);
});

test("ProductSerialService.parseFile rechaza archivos vacíos o de otro tipo", async () => {
  const { service } = buildService();

  await assert.rejects(() => service.parseFile(undefined), /Adjunta un archivo/);
  await assert.rejects(
    () => service.parseFile({ originalname: "series.pdf", buffer: Buffer.from("x") }),
    /Solo se permiten archivos/
  );
  await assert.rejects(
    () => service.parseFile({ originalname: "series.csv", buffer: Buffer.from("Serie\r\n\r\n") }),
    /no contiene series/
  );
});

test("ProductSerialService.listByProduct usa AVAILABLE por defecto, busca en mayúsculas y valida el límite", async () => {
  const { service, calls } = buildService();

  const result = await service.listByProduct(
    tenantId,
    { productId: serialProduct, branchId: branchA, search: " lgac-00 " },
    admin
  );

  assert.equal(result.total, 1);
  assert.equal(result.items[0].serialNumber, "LGAC-0001");
  assert.deepEqual(calls.listByProduct[0], {
    tenantId,
    productId: serialProduct,
    branchId: branchA,
    status: "AVAILABLE",
    search: "LGAC-00",
    limit: 50,
    offset: 0,
  });
  await assert.rejects(
    () => service.listByProduct(tenantId, { productId: serialProduct, branchId: branchA, limit: 500 }, admin),
    /limit debe ser un entero/
  );
  await assert.rejects(
    () => service.listByProduct(tenantId, { productId: serialProduct, branchId: branchA, status: "PERDIDA" }, admin),
    /status no válido/
  );
});

test("ProductSerialService.lookup normaliza y limita a las sucursales del usuario", async () => {
  const { service, calls } = buildService({ accessibleBranches: [branchA] });

  await service.lookup(tenantId, { serialNumber: " lgac-0001 " }, admin);
  await service.lookup(tenantId, { serialNumber: "LGAC-0001" }, superUser);

  assert.deepEqual(calls.findBySerialNumber[0], {
    tenantId,
    normalized: "LGAC-0001",
    branchIds: [branchA],
    productId: undefined,
  });
  assert.equal((calls.findBySerialNumber[1] as { branchIds: unknown }).branchIds, null);
  await assert.rejects(() => service.lookup(tenantId, { serialNumber: "con espacio" }, admin), /serial no válido/);
});

test("ProductSerialService.getHistory no expone series de otra sucursal", async () => {
  const { service } = buildService({ accessibleBranches: [branchA] });

  await assert.rejects(() => service.getHistory(tenantId, "00000000-0000-0000-0000-000000000501", admin), /not authorized/);
  await assert.rejects(() => service.getHistory(tenantId, "missing", superUser), /Serie no encontrada/);
  const history = await service.getHistory(tenantId, "00000000-0000-0000-0000-000000000501", superUser);
  assert.equal(history.serial.branchId, branchB);
});

test("normalización y lectura de texto pegado", () => {
  assert.equal(normalizeSerialNumber("  lg-01 "), "LG-01");
  assert.equal(normalizeSerialNumber(123), "");
  assert.deepEqual(parseSerialText("serie\nA1\n\nA2\tx\n"), ["A1", "A2"]);
  assert.deepEqual(parseSerialText("A1\nserie"), ["A1", "serie"]);
});

test("mapSerialDatabaseError traduce los códigos SERIAL_* y deja pasar los demás", () => {
  const conflict = mapSerialDatabaseError({ message: "SERIAL_NOT_AVAILABLE", detail: "item-1" });
  assert.ok(conflict instanceof HttpException);
  assert.equal(conflict.getStatus(), 409);
  assert.deepEqual(conflict.getResponse(), {
    code: "SERIAL_NOT_AVAILABLE",
    message: "Una o más series ya no están disponibles. Selecciona otra serie.",
    detail: "item-1",
  });
  assert.equal(mapSerialDatabaseError({ message: "SERIAL_COUNT_MISMATCH" })?.getStatus(), 400);
  assert.equal(mapSerialDatabaseError({ message: "SERIAL_NOT_FOUND" })?.getStatus(), 404);
  assert.equal(mapSerialDatabaseError(new Error("otro error")), null);
  assert.ok(SERIAL_ERROR_CODES.length >= 20);
});

test("ProductSerialController: permisos por endpoint", () => {
  const permissionOf = (method: keyof ProductSerialController) =>
    Reflect.getMetadata(PERMISSION_KEY, ProductSerialController.prototype[method]);

  assert.deepEqual(permissionOf("validate"), {
    menuKey: ["INVENTORY_PURCHASES", "INVENTORY_SERIALS", "INVENTORY"],
    level: "READ",
  });
  assert.deepEqual(permissionOf("available").menuKey, ["POS", "ORDERS", "INVENTORY_SERIALS", "INVENTORY"]);
  assert.deepEqual(permissionOf("lookup").menuKey, ["POS", "ORDERS", "INVENTORY_SERIALS", "INVENTORY"]);
  assert.deepEqual(permissionOf("search").menuKey, ["INVENTORY_SERIALS", "INVENTORY"]);
  assert.deepEqual(permissionOf("history").menuKey, ["INVENTORY_SERIALS", "INVENTORY"]);
  assert.deepEqual(permissionOf("inspect"), { menuKey: "INVENTORY_SERIALS", level: "WRITE" });
  assert.deepEqual(permissionOf("moveLocation"), { menuKey: "INVENTORY_SERIALS", level: "WRITE" });
  assert.deepEqual(permissionOf("locationCounts").menuKey, ["INVENTORY", "INVENTORY_SERIALS"]);
});

test("ProductSerialService.assignForSale traduce el error e informa el producto de la línea", async () => {
  const saleItemId = "30000000-0000-4000-8000-000000000001";
  const dbError = Object.assign(new Error("SERIAL_NOT_AVAILABLE"), { code: "P0001", detail: saleItemId });
  const repository = {
    assignSale: async () => {
      throw dbError;
    },
  };
  const service = new ProductSerialService(repository as never, {} as never);

  await assert.rejects(
    service.assignForSale({} as never, {
      tenantId,
      branchId: branchA,
      saleId: "30000000-0000-4000-8000-000000000002",
      lines: [{ saleItemId, productId: serialProduct, serialIds: ["30000000-0000-4000-8000-000000000003"] }],
      userId: null,
    }),
    (error: unknown) => {
      assert.ok(error instanceof HttpException);
      assert.equal(error.getStatus(), 409);
      assert.deepEqual(error.getResponse(), {
        code: "SERIAL_NOT_AVAILABLE",
        message: "Una o más series ya no están disponibles. Selecciona otra serie.",
        productId: serialProduct,
      });
      return true;
    }
  );
});

test("ProductSerialService.assignForSale y markReturnedForSale envían solo las series al repositorio", async () => {
  const calls: Record<string, unknown> = {};
  const repository = {
    assignSale: async (_client: unknown, input: unknown) => {
      calls.assign = input;
      return 1;
    },
    markSaleReturned: async (_client: unknown, input: unknown) => {
      calls.returned = input;
      return 1;
    },
  };
  const service = new ProductSerialService(repository as never, {} as never);
  const line = { saleItemId: "s-item", productId: serialProduct, serialIds: ["serial-1"] };

  assert.equal(
    await service.assignForSale({} as never, { tenantId, branchId: branchA, saleId: "sale-1", lines: [line], userId: "u1" }),
    1
  );
  assert.deepEqual((calls.assign as { lines: unknown[] }).lines, [{ saleItemId: "s-item", serialIds: ["serial-1"] }]);

  await service.markReturnedForSale({} as never, {
    tenantId,
    saleId: "sale-1",
    returnInventory: false,
    userId: "u1",
    reason: "Anulada sin devolución",
  });
  assert.equal((calls.returned as { returnInventory: boolean }).returnInventory, false);
});

test("ProductSerialService.assignForOrderDelivery informa el producto rechazado", async () => {
  const dbError = Object.assign(new Error("SERIAL_COUNT_MISMATCH"), {
    code: "P0001",
    detail: `productId=${serialProduct} expected=2 received=1`,
  });
  const service = new ProductSerialService(
    { assignOrderDelivery: async () => { throw dbError; } } as never,
    {} as never
  );

  await assert.rejects(
    service.assignForOrderDelivery({} as never, {
      tenantId,
      branchId: branchA,
      orderId: "order-1",
      lines: [{ productId: serialProduct, quantity: 2, stockMovementId: "mov-1", serialIds: ["s1"] }],
      userId: null,
    }),
    (error: unknown) => {
      assert.ok(error instanceof HttpException);
      assert.equal(error.getStatus(), 400);
      assert.equal((error.getResponse() as { productId?: string }).productId, serialProduct);
      return true;
    }
  );
});

const buildOpsService = (options: { serialBranch?: string; inspectError?: Error } = {}) => {
  const statements: string[] = [];
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, value: unknown) => {
    calls[name] = [...(calls[name] ?? []), value];
  };
  const client = {
    query: async (text: string) => {
      statements.push(text);
      return { rows: [] };
    },
    release: () => record("release", true),
  };
  const repository = {
    getClient: async () => client,
    findById: async () => serialRow({ id: "serial-1", branch_id: options.serialBranch ?? branchA, status: "RETURNED" }),
    lockStockScope: async (_c: unknown, ...args: unknown[]) => record("lock", args),
    inspect: async (_c: unknown, input: unknown) => {
      record("inspect", input);
      if (options.inspectError) {
        throw options.inspectError;
      }
      return "OK";
    },
    findBranchesForSerials: async (_t: string, ids: string[]) => ids.map((id) => ({ id, branch_id: options.serialBranch ?? branchA })),
    moveLocation: async (_c: unknown, input: unknown) => {
      record("move", input);
      return 2;
    },
  };
  const stockMovementService = {
    createMovement: async (data: Record<string, unknown>) => {
      record("movement", data);
      return { ...data, id: "movement-1" };
    },
    logMovementAuditEvent: () => record("audit", true),
  };
  const service = new ProductSerialService(
    repository as never,
    { findAccessibleBranchIds: async () => [branchA] } as never,
    stockMovementService as never
  );
  return { service, statements, calls };
};

test("ProductSerialService.inspect da de baja con un OUT de 1 unidad en la misma transacción", async () => {
  const { service, statements, calls } = buildOpsService();

  await service.inspect(tenantId, "serial-1", { result: "written_off", reason: "Equipo dañado" }, admin);

  assert.deepEqual(statements, ["BEGIN", "COMMIT"]);
  assert.equal((calls.movement[0] as { type: string; quantity: number }).type, "OUT");
  assert.equal((calls.movement[0] as { quantity: number }).quantity, 1);
  assert.equal((calls.inspect[0] as { stockMovementId: string }).stockMovementId, "movement-1");
  assert.equal((calls.inspect[0] as { result: string }).result, "WRITTEN_OFF");
  assert.equal(calls.audit.length, 1);
});

test("ProductSerialService.inspect a disponible no crea movimientos y revierte errores de la función", async () => {
  const ok = buildOpsService();
  await ok.service.inspect(tenantId, "serial-1", { result: "AVAILABLE", reason: "Revisado sin daños" }, admin);
  assert.equal(ok.calls.movement, undefined);
  assert.equal((ok.calls.inspect[0] as { stockMovementId: unknown }).stockMovementId, null);

  const failing = buildOpsService({
    inspectError: Object.assign(new Error("SERIAL_TRANSITION_INVALID"), { code: "P0001" }),
  });
  await assert.rejects(
    failing.service.inspect(tenantId, "serial-1", { result: "AVAILABLE", reason: "Revisado sin daños" }, admin),
    (error: unknown) => error instanceof HttpException && error.getStatus() === 409
  );
  assert.deepEqual(failing.statements, ["BEGIN", "ROLLBACK"]);
});

test("ProductSerialService.inspect valida resultado, motivo y sucursal", async () => {
  const { service } = buildOpsService({ serialBranch: branchB });
  await assert.rejects(service.inspect(tenantId, "serial-1", { result: "SOLD", reason: "motivo largo" }, admin));
  await assert.rejects(service.inspect(tenantId, "serial-1", { result: "AVAILABLE", reason: "no" }, admin));
  await assert.rejects(
    service.inspect(tenantId, "serial-1", { result: "AVAILABLE", reason: "Revisado sin daños" }, admin),
    (error: unknown) => error instanceof HttpException && error.getStatus() === 403
  );
});

test("ProductSerialService.moveLocation valida y mueve en una transacción", async () => {
  const { service, statements, calls } = buildOpsService();
  const ids = ["30000000-0000-4000-8000-000000000001", "30000000-0000-4000-8000-000000000002"];

  const result = await service.moveLocation(
    tenantId,
    { serialIds: ids, locationId: "30000000-0000-4000-8000-0000000000aa", reason: "Reubicación" },
    admin
  );

  assert.deepEqual(result, { moved: 2 });
  assert.deepEqual(statements, ["BEGIN", "COMMIT"]);
  assert.equal((calls.move[0] as { locationId: string }).locationId, "30000000-0000-4000-8000-0000000000aa");
  await assert.rejects(service.moveLocation(tenantId, { serialIds: ["x"], locationId: null }, admin));
});

test("ProductSerialService.countByLocation limita a las sucursales del usuario", async () => {
  const calls: unknown[] = [];
  const service = new ProductSerialService(
    {
      countInStockByLocation: async (input: unknown) => {
        calls.push(input);
        return [{ location_id: "loc-1", branch_id: branchA, serial_count: "3" }];
      },
    } as never,
    { findAccessibleBranchIds: async () => [branchA] } as never
  );

  const result = await service.countByLocation(tenantId, {}, admin);

  assert.deepEqual(result, { items: [{ locationId: "loc-1", branchId: branchA, count: 3 }] });
  assert.deepEqual(calls, [{ tenantId, branchIds: [branchA] }]);
});

test("ProductSerialService.reconcile calcula diferencias y limita a las sucursales del usuario", async () => {
  const calls: unknown[] = [];
  const service = new ProductSerialService(
    {
      reconcile: async (input: unknown) => {
        calls.push(input);
        return [
          { product_id: "p-1", product_name: "Inverter", product_sku: "INV", branch_id: branchA, branch_name: "Principal", serial_count: "2", kardex_stock: "3" },
          { product_id: "p-2", product_name: "Nevera", product_sku: "NEV", branch_id: branchA, branch_name: "Principal", serial_count: 4, kardex_stock: "4.000" },
        ];
      },
    } as never,
    { findAccessibleBranchIds: async () => [branchA] } as never
  );

  const result = await service.reconcile(tenantId, {}, admin);

  assert.equal(result.differences, 1);
  assert.deepEqual(result.items.map((item) => item.difference), [1, 0]);
  assert.deepEqual(calls, [{ tenantId, branchIds: [branchA], productId: null }]);
});

test("normalizeSerialInputs acepta series con ubicación propia mezcladas con texto", () => {
  assert.deepEqual(
    normalizeSerialInputs(["A-1", { serialNumber: "A-2", locationId: "loc-9" }, { serial: "A-3" }]),
    [
      { serial: "A-1", locationId: null },
      { serial: "A-2", locationId: "loc-9" },
      { serial: "A-3", locationId: null },
    ]
  );
  assert.equal(normalizeSerialInputs(undefined), undefined);
});
