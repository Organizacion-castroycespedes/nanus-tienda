import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { HealthController } from "../src/modules/health/health.controller";
import { DevicesService } from "../src/modules/devices/devices.service";
import { EventsService } from "../src/modules/events/events.service";
import { LogsService } from "../src/modules/logs/logs.service";
import { FileDeviceRegistryStateStore } from "../src/platform/device-registry-state.store";
import { buildUsbPrinterDescriptor, type UsbPrinterDiscovery } from "../src/shared/usb/usb-printer-discovery";

const packageJson = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf8")
);

class FakeUsbDiscovery implements UsbPrinterDiscovery {
  list() {
    return [buildUsbPrinterDescriptor("Xprinter XP-80T USB")];
  }
}

const createDevicesService = () => {
  const root = mkdtempSync(join(tmpdir(), "manus-peripheral-agent-health-"));
  return new DevicesService(
    new LogsService(),
    new EventsService(),
    new FakeUsbDiscovery(),
    new FileDeviceRegistryStateStore(),
    {
      configDir: join(root, "config"),
      stateDir: join(root, "state"),
      logDir: join(root, "logs"),
    }
  );
};

test("health responds with MOCK agent metadata", () => {
  process.env.PERIPHERALS_AGENT_NAME = "manus-pos-peripheral-agent";
  process.env.PERIPHERALS_MODE = "MOCK";

  const controller = new HealthController(createDevicesService());
  const result = controller.getHealth();

  assert.equal(result.status, "ok");
  assert.equal(result.agent, "manus-pos-peripheral-agent");
  assert.equal(result.mode, "MOCK");
  assert.equal(result.version, packageJson.version);
  assert.equal(typeof result.uptimeSeconds, "number");
  assert.equal(typeof result.agentInstallationId, "string");
  assert.equal(result.platform, process.platform);
  assert.equal(result.architecture, process.arch);
  assert.equal(result.configuredDevices, 0);
  assert.equal(result.discoveredDevices, 0);
  assert.equal(result.persistenceState.schemaVersion, 1);
  assert.equal(result.persistenceState.status, "empty");
});
