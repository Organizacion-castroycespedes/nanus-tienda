import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PlatformTenantGuard } from "../../common/guards/platform-tenant.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ControlCenterEnabledGuard } from "./control-center-enabled.guard";
import { ControlCenterModule } from "./control-center.module";

const REQUIRED_GUARDS = [JwtAuthGuard, RolesGuard, PlatformTenantGuard, ControlCenterEnabledGuard];

const controllers = (Reflect.getMetadata("controllers", ControlCenterModule) ?? []) as Array<
  new (...args: any[]) => unknown
>;

test("control-center module registers at least one controller", () => {
  assert.ok(controllers.length > 0);
});

for (const controller of controllers) {
  test(`${controller.name}: lives under admin/control-center`, () => {
    const path = String(Reflect.getMetadata(PATH_METADATA, controller) ?? "");
    assert.match(path, /^\/?admin\/control-center(\/|$)/);
  });

  test(`${controller.name}: declares the full guard chain in order at class level`, () => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
    assert.deepEqual(guards.slice(0, REQUIRED_GUARDS.length), REQUIRED_GUARDS);
  });

  test(`${controller.name}: requires SUPER_ADMIN at class level`, () => {
    assert.deepEqual(Reflect.getMetadata(ROLES_KEY, controller), ["SUPER_ADMIN"]);
  });

  test(`${controller.name}: no handler overrides roles or relaxes guards`, () => {
    const prototype = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name === "constructor") continue;
      const handler = prototype[name];
      if (typeof handler !== "function") continue;
      if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
      const handlerRoles = Reflect.getMetadata(ROLES_KEY, handler);
      if (handlerRoles !== undefined) {
        assert.deepEqual(handlerRoles, ["SUPER_ADMIN"], `${name} overrides @Roles`);
      }
    }
  });
}
