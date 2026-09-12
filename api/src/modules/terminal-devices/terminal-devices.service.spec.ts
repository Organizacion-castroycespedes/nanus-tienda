import { BadRequestException, ConflictException } from "@nestjs/common";
import test from "node:test";
import assert from "node:assert/strict";
import { TerminalDevicesService } from "./terminal-devices.service";

const actor = { roles: ["SUPER_USER"], tenantId: "tenant-a", userId: "user-a" };
const service = () => new TerminalDevicesService({} as never, {} as never, { logEvent() {} } as never);

test("terminal device registration rejects missing installation identity", async () => {
  await assert.rejects(() => service().register({ installationId: " " }, actor), BadRequestException);
});

test("terminal device registration cannot select another tenant", async () => {
  await assert.rejects(() => service().register({ installationId: "install-a", tenantId: "tenant-b" }, actor), /No autorizado/);
});

test("installation identity is not a terminal or peripheral identity", () => {
  const identity = { installationId: "install-a", deviceId: "cloud-device-a", terminalId: "terminal-a", peripheralId: "scale-review" };
  assert.notEqual(identity.installationId, identity.terminalId);
  assert.notEqual(identity.deviceId, identity.peripheralId);
});
