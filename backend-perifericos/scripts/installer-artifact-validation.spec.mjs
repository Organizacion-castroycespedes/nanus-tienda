import test from "node:test";
import assert from "node:assert/strict";
import { validateInstallerInspectData, validateInstallerStatusData } from "./installer-artifact-validation.mjs";

const inspectFixture = (overrides = {}) => ({
  version: "0.1.1-qa.13",
  serviceName: "ManusPeripheralAgent",
  displayName: "Manus Peripheral Agent",
  serviceAccount: "NT AUTHORITY\\LocalService",
  installRoot: "C:\\Program Files\\Manus\\PeripheralAgent",
  currentRoot: "C:\\Program Files\\Manus\\PeripheralAgent\\current",
  serviceBinary: "C:\\Program Files\\Manus\\PeripheralAgent\\versions\\0.1.1-qa.13\\ManusTerminalSetup.exe",
  serviceArgs: ["service"],
  ...overrides,
});

const statusFixture = (overrides = {}) => ({
  installed: false,
  servicePresent: false,
  serviceRunning: false,
  installRoot: "C:\\Program Files\\Manus\\PeripheralAgent",
  currentRoot: "C:\\Program Files\\Manus\\PeripheralAgent\\current",
  logsPath: "C:\\ProgramData\\Manus\\PeripheralAgent\\logs",
  serviceBinary: "C:\\Program Files\\Manus\\PeripheralAgent\\versions\\0.1.1-qa.13\\ManusTerminalSetup.exe",
  ...overrides,
});

test("accepts an absent service", () => {
  assert.deepEqual(validateInstallerStatusData(statusFixture()), {
    serviceState: "absent",
    hostServiceNotice: "",
  });
});

test("accepts an installed stopped service", () => {
  const result = validateInstallerStatusData(statusFixture({ installed: true, servicePresent: true }));
  assert.equal(result.serviceState, "stopped");
  assert.match(result.hostServiceNotice, /stopped/);
});

test("accepts an installed running service without changing host state", () => {
  const result = validateInstallerStatusData(statusFixture({ installed: true, servicePresent: true, serviceRunning: true }));
  assert.equal(result.serviceState, "running");
  assert.match(result.hostServiceNotice, /running/);
});

test("rejects an incoherent running status", () => {
  assert.throws(
    () => validateInstallerStatusData(statusFixture({ serviceRunning: true })),
    /serviceRunning cannot be true/,
  );
});

test("rejects malformed status data", () => {
  assert.throws(
    () => validateInstallerStatusData(statusFixture({ servicePresent: "true" })),
    /servicePresent must be a boolean/,
  );
});

test("rejects corrupt installer metadata", () => {
  assert.throws(
    () => validateInstallerInspectData(inspectFixture({ version: "0.1.1-qa.11" }), { agentVersion: "0.1.1-qa.13" }),
    /Expected values to be strictly equal/,
  );
  assert.throws(
    () => validateInstallerInspectData(inspectFixture({ serviceBinary: "C:\\Temp\\ManusTerminalSetup.exe" }), { agentVersion: "0.1.1-qa.13" }),
    /did not match the regular expression/,
  );
});
