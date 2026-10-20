import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { DeviceProfileId, getDeviceProfile } from "../src/shared/profiles/device-profiles";
import {
  ConnectionType,
  DeviceType,
  type SerialConnectionOptions,
} from "../src/shared/types/peripheral.types";
import {
  parseSerialConnectionOptions,
  resolveSerialOptionsForConnection,
} from "../src/shared/utils/request-validation.util";
import { FileDeviceRegistryStateStore } from "../src/platform/device-registry-state.store";
import { DevicesController } from "../src/modules/devices/devices.controller";
import { DevicesService } from "../src/modules/devices/devices.service";
import { EventsService } from "../src/modules/events/events.service";
import { LogsService } from "../src/modules/logs/logs.service";
import type { UsbPrinterDiscovery } from "../src/shared/usb/usb-printer-discovery";

const paths = () => {
  const root = mkdtempSync(join(tmpdir(), "manus-serial-model-"));
  return {
    configDir: join(root, "config"),
    stateDir: join(root, "state"),
    logDir: join(root, "logs"),
  };
};

const rochiSerial: SerialConnectionOptions = {
  port: "COM_TEST_001",
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  flowControl: "none",
  pnp: {
    deviceId: "USB\\VID_1A86&PID_7523\\ROCHI-QA",
    vendorId: "1A86",
    productId: "7523",
  },
};

test("ROCHI_A01E profile exposes only certified serial defaults", () => {
  const profile = getDeviceProfile(DeviceProfileId.RochiA01e);

  assert.equal(profile.deviceType, DeviceType.SCALE);
  assert.equal(profile.connectionType, ConnectionType.SERIAL);
  assert.deepEqual(profile.serial, {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    flowControl: "none",
  });
  assert.equal("authorized" in profile, false);
  assert.equal("stable" in profile, false);
});

test("SERIAL configuration validates and preserves PnP identity", () => {
  assert.deepEqual(parseSerialConnectionOptions(rochiSerial), rochiSerial);
  assert.deepEqual(
    resolveSerialOptionsForConnection(rochiSerial, ConnectionType.SERIAL),
    rochiSerial
  );
});

test("SERIAL configuration rejects incomplete or unsupported values", () => {
  assert.throws(
    () => parseSerialConnectionOptions({ ...rochiSerial, parity: "mark" }),
    /parity is not supported/
  );
  assert.throws(
    () => parseSerialConnectionOptions({ ...rochiSerial, baudRate: 12345 }),
    /baudRate is not supported/
  );
  assert.throws(
    () => parseSerialConnectionOptions({ ...rochiSerial, pnp: { vendorId: "1A86" } }),
    /pnp.deviceId must be a non-empty string/
  );
  assert.throws(
    () => resolveSerialOptionsForConnection(undefined, ConnectionType.SERIAL),
    /serial configuration is required/
  );
  assert.throws(
    () => resolveSerialOptionsForConnection(rochiSerial, ConnectionType.NETWORK),
    /serial is only supported/
  );
});

test("serial state round-trips with schema 1 and old state remains valid", () => {
  const store = new FileDeviceRegistryStateStore();
  const testPaths = paths();
  const device = {
    id: "scale-rochi-local-001",
    type: DeviceType.SCALE,
    name: "ROCHI RC-A01E",
    connectionType: ConnectionType.SERIAL,
    terminalId: "local-terminal",
    profileId: DeviceProfileId.RochiA01e,
    serial: rochiSerial,
  };

  store.write(testPaths, { schemaVersion: 1, devices: [device] });
  const restored = store.read(testPaths)?.devices[0];
  assert.ok(restored);
  assert.equal(restored?.type, device.type);
  assert.equal(restored?.connectionType, device.connectionType);
  assert.equal(restored?.profileId, device.profileId);
  assert.deepEqual(restored?.serial, device.serial);

  const oldPaths = paths();
  store.write(oldPaths, {
    schemaVersion: 1,
    devices: [{
      id: "printer-old-state",
      type: DeviceType.PRINTER,
      name: "Old printer",
      connectionType: ConnectionType.MOCK,
      terminalId: "local-terminal",
    }],
  });
  assert.equal(store.read(oldPaths)?.devices[0].serial, undefined);
});

test("device HTTP create and update preserve configured SERIAL SCALE", () => {
  const testPaths = paths();
  const emptyDiscovery: UsbPrinterDiscovery = { list: () => [] };
  const service = new DevicesService(
    new LogsService(),
    new EventsService(),
    emptyDiscovery,
    new FileDeviceRegistryStateStore(),
    testPaths
  );
  const controller = new DevicesController(service);

  const created = controller.create({
    id: "scale-rochi-http-001",
    type: DeviceType.SCALE,
    name: "ROCHI HTTP",
    connectionType: ConnectionType.SERIAL,
    terminalId: "local-terminal",
    profileId: DeviceProfileId.RochiA01e,
    serial: rochiSerial,
  });
  assert.deepEqual(created.serial, rochiSerial);

  const updated = controller.update(created.id, { name: "ROCHI HTTP UPDATED" });
  assert.equal(updated.name, "ROCHI HTTP UPDATED");
  assert.deepEqual(updated.serial, rochiSerial);

  assert.throws(
    () => controller.create({
      id: "scale-rochi-invalid-profile-001",
      type: DeviceType.SCALE,
      name: "ROCHI INVALID",
      connectionType: ConnectionType.MOCK,
      terminalId: "local-terminal",
      profileId: DeviceProfileId.RochiA01e,
    }),
    /profileId is incompatible with connection type/
  );
});
