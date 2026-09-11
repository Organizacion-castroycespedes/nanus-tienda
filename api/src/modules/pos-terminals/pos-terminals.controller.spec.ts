import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { PosTerminalsController } from "./pos-terminals.controller";

test("peripheral administration endpoints are SUPER_ADMIN only", () => {
  for (const method of ["list", "get", "create", "update", "getPeripheralSettings", "savePeripheralSettings"]) {
    const fn = (PosTerminalsController.prototype as Record<string, unknown>)[method];
    assert.deepEqual(Reflect.getMetadata(ROLES_KEY, fn), ["SUPER_ADMIN"]);
  }
});

test("operational current-terminal resolution keeps class role policy", () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, PosTerminalsController), ["SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER"]);
});
