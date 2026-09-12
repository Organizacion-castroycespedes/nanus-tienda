import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { TerminalDevicesController, TerminalDeviceBindingsController } from "./terminal-devices.controller";

test("device and binding administration are SUPER_ADMIN only", () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, TerminalDevicesController), ["SUPER_ADMIN"]);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, TerminalDeviceBindingsController), ["SUPER_ADMIN"]);
});
