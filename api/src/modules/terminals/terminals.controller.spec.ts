import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "reflect-metadata";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { PERMISSION_KEY } from "../../common/decorators/require-permission.decorator";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { TerminalsController } from "./terminals.controller";

const getMethodPermission = (methodName: string) => {
  const method = (TerminalsController.prototype as Record<string, unknown>)[methodName];
  assert.equal(typeof method, "function", `${methodName} must be a method`);
  return Reflect.getMetadata(PERMISSION_KEY, method) as
    | { menuKey: string; level: string }
    | undefined;
};

describe("TerminalsController permissions", () => {
  it("keeps terminal administration scoped to SUPER_ADMIN", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, TerminalsController) as
      | string[]
      | undefined;
    assert.deepEqual(roles, ["SUPER_ADMIN"]);
    assert.equal(roles?.includes("ADMIN"), false);
    assert.equal(roles?.includes("USER"), false);
  });

  it("uses CONFIG_TERMINALS instead of generic configuration permission", () => {
    const expectations: Array<[string, string]> = [
      ["list", "READ"],
      ["create", "WRITE"],
      ["update", "WRITE"],
      ["updateStatus", "WRITE"],
    ];

    for (const [methodName, level] of expectations) {
      const permission = getMethodPermission(methodName);
      assert.equal(
        permission?.menuKey,
        MENU_KEYS.CONFIG_TERMINALS,
        `TerminalsController.${methodName} must use CONFIG_TERMINALS`
      );
      assert.equal(permission?.level, level);
      assert.notEqual(permission?.menuKey, MENU_KEYS.CONFIG_GENERAL);
    }
  });
});
