import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DeliveryDriversService } from "./delivery-drivers.service";

const tenantId = "00000000-0000-0000-0000-000000000001";
const otherTenantId = "00000000-0000-0000-0000-000000000099";
const driverId = "00000000-0000-0000-0000-000000000010";

const actor = {
  tenantId,
  userId: "00000000-0000-0000-0000-000000000003",
  roles: ["ADMIN"],
};

const buildDriver = (overrides: Record<string, unknown> = {}) => ({
  id: driverId,
  tenant_id: tenantId,
  name: "Carlos Repartidor",
  phone: "3001234567",
  document_number: "123456",
  active: true,
  notes: null,
  created_at: "2026-06-22T00:00:00.000Z",
  updated_at: "2026-06-22T00:00:00.000Z",
  ...overrides,
});

test("DeliveryDriversService.create creates active tenant driver", async () => {
  const queries: Array<{ text: string; params: unknown[] }> = [];
  const service = new DeliveryDriversService({
    query: async (text: string, params: unknown[] = []) => {
      queries.push({ text, params });
      if (text.includes("information_schema.tables")) {
        return { rows: [{ exists: true }] };
      }
      if (text.includes("INSERT INTO public.delivery_drivers")) {
        assert.deepEqual(params, [
          tenantId,
          "Carlos Repartidor",
          "3001234567",
          "123456",
          true,
          null,
        ]);
        return { rows: [buildDriver()] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  } as never);

  const result = await service.create(
    {
      name: " Carlos Repartidor ",
      phone: "3001234567",
      document_number: "123456",
    },
    actor
  );

  assert.equal(result.id, driverId);
  assert.equal(result.tenant_id, tenantId);
  assert.equal(result.active, true);
  assert.equal(queries.length, 2);
});

test("DeliveryDriversService.list returns empty when migration is pending", async () => {
  const service = new DeliveryDriversService({
    query: async (text: string) => {
      if (text.includes("information_schema.tables")) {
        return { rows: [{ exists: false }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  } as never);

  const result = await service.list({}, actor);

  assert.deepEqual(result, []);
});

test("DeliveryDriversService.update edits same-tenant driver", async () => {
  const service = new DeliveryDriversService({
    query: async (text: string, params: unknown[] = []) => {
      if (text.includes("information_schema.tables")) {
        return { rows: [{ exists: true }] };
      }
      if (text.includes("UPDATE public.delivery_drivers")) {
        assert.equal(params[0], "Nuevo Nombre");
        assert.equal(params[1], "311");
        assert.equal(params[2], driverId);
        assert.equal(params[3], tenantId);
        return {
          rows: [buildDriver({ name: "Nuevo Nombre", phone: "311" })],
        };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  } as never);

  const result = await service.update(
    driverId,
    { name: " Nuevo Nombre ", phone: "311" },
    actor
  );

  assert.equal(result.name, "Nuevo Nombre");
  assert.equal(result.phone, "311");
});

test("DeliveryDriversService.deactivate marks driver inactive", async () => {
  const service = new DeliveryDriversService({
    query: async (text: string, params: unknown[] = []) => {
      if (text.includes("information_schema.tables")) {
        return { rows: [{ exists: true }] };
      }
      if (text.includes("UPDATE public.delivery_drivers")) {
        assert.deepEqual(params, [driverId, tenantId]);
        return { rows: [buildDriver({ active: false })] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  } as never);

  const result = await service.deactivate(driverId, actor);

  assert.equal(result.active, false);
});

test("DeliveryDriversService enforces tenant isolation", async () => {
  const service = new DeliveryDriversService({
    query: async (text: string) =>
      text.includes("information_schema.tables")
        ? { rows: [{ exists: true }] }
        : { rows: [] },
  } as never);

  await assert.rejects(
    () =>
      service.getById(driverId, {
        ...actor,
        tenantId: otherTenantId,
      }),
    NotFoundException
  );
  await assert.rejects(
    () => service.update(driverId, { name: "Otro" }, actor),
    NotFoundException
  );
});

test("DeliveryDriversService rejects blank update payload", async () => {
  const service = new DeliveryDriversService({
    query: async (text: string) =>
      text.includes("information_schema.tables")
        ? { rows: [{ exists: true }] }
        : { rows: [] },
  } as never);

  await assert.rejects(
    () => service.update(driverId, {}, actor),
    BadRequestException
  );
});
