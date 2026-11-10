import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { BillingNoticesController } from "./billing-notices.controller";
import { BillingNoticesService } from "./billing-notices.service";

const fakeDb = (rows: unknown[] | Error) => {
  const calls: { text: string; params?: unknown[] }[] = [];
  return {
    calls,
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      if (rows instanceof Error) throw rows;
      return { rows };
    },
  };
};

test("billing notices: only tenant administrators, behind JWT and roles guards", () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, BillingNoticesController), [JwtAuthGuard, RolesGuard]);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, BillingNoticesController), ["SUPER_ADMIN", "SUPER_USER", "ADMIN"]);
  assert.ok(!(Reflect.getMetadata(ROLES_KEY, BillingNoticesController) as string[]).includes("USER"));
});

test("billing notices: query is scoped to the token tenant and active notices only", async () => {
  const db = fakeDb([{ id: "n1", chargeNumber: "MCC-COB-2026-000001" }]);
  const controller = new BillingNoticesController(new BillingNoticesService(db));
  const result = await controller.active({ user: { tenantId: "11111111-1111-1111-1111-111111111111" } });
  assert.equal(result.items.length, 1);
  assert.deepEqual(db.calls[0].params, ["11111111-1111-1111-1111-111111111111"]);
  assert.match(db.calls[0].text, /tenant_id = \$1 AND resolved_at IS NULL/);
  assert.doesNotMatch(db.calls[0].text, /control_center\./);
});

test("billing notices: no tenant in token returns nothing without querying", async () => {
  const db = fakeDb([]);
  const result = await new BillingNoticesController(new BillingNoticesService(db)).active({});
  assert.deepEqual(result.items, []);
  assert.equal(db.calls.length, 0);
});

test("billing notices: missing table or permission degrades to an empty list", async () => {
  const missing = Object.assign(new Error("relation does not exist"), { code: "42P01" });
  assert.deepEqual(await new BillingNoticesService(fakeDb(missing)).activeForTenant("t"), []);
  const denied = Object.assign(new Error("permission denied"), { code: "42501" });
  assert.deepEqual(await new BillingNoticesService(fakeDb(denied)).activeForTenant("t"), []);
  await assert.rejects(new BillingNoticesService(fakeDb(new Error("boom"))).activeForTenant("t"));
});
