import assert from "node:assert/strict";

const assertString = (value, message) => assert.equal(typeof value, "string", message);

export const validateInstallerInspectData = (inspectData, { agentVersion }) => {
  assert.ok(inspectData && typeof inspectData === "object", "inspect data must be an object");
  assert.equal(inspectData.version, agentVersion);
  assert.equal(inspectData.serviceName, "ManusPeripheralAgent");
  assert.equal(inspectData.displayName, "Manus Peripheral Agent");
  assert.equal(inspectData.serviceAccount, "NT AUTHORITY\\LocalService");
  assertString(inspectData.installRoot, "installRoot must be a string");
  assertString(inspectData.currentRoot, "currentRoot must be a string");
  assertString(inspectData.serviceBinary, "serviceBinary must be a string");
  assert.match(inspectData.installRoot, /Program Files\\Manus\\PeripheralAgent/);
  assert.match(inspectData.currentRoot, /Program Files\\Manus\\PeripheralAgent\\current/);
  assert.match(inspectData.serviceBinary, /Program Files\\Manus\\PeripheralAgent\\versions\\/);
  assert.match(inspectData.serviceBinary, /ManusTerminalSetup\.exe$/);
  assert.ok(Array.isArray(inspectData.serviceArgs), "serviceArgs must be an array");
  assert.equal(inspectData.serviceArgs[0], "service");
  return inspectData;
};

export const validateInstallerStatusData = (statusData) => {
  assert.ok(statusData && typeof statusData === "object", "status data must be an object");
  for (const field of ["installed", "servicePresent", "serviceRunning"]) {
    assert.equal(typeof statusData[field], "boolean", `${field} must be a boolean`);
  }
  assert.equal(
    statusData.serviceRunning && !statusData.servicePresent,
    false,
    "serviceRunning cannot be true when servicePresent is false",
  );
  assertString(statusData.installRoot, "installRoot must be a string");
  assertString(statusData.currentRoot, "currentRoot must be a string");
  assertString(statusData.logsPath, "logsPath must be a string");
  assertString(statusData.serviceBinary, "serviceBinary must be a string");
  assert.match(statusData.installRoot, /Program Files\\Manus\\PeripheralAgent/);
  assert.match(statusData.currentRoot, /Program Files\\Manus\\PeripheralAgent\\current/);
  assert.match(statusData.logsPath, /ProgramData\\Manus\\PeripheralAgent\\logs/);
  assert.match(statusData.serviceBinary, /Program Files\\Manus\\PeripheralAgent\\versions\\/);
  assert.match(statusData.serviceBinary, /ManusTerminalSetup\.exe$/);
  return {
    serviceState: statusData.serviceRunning ? "running" : statusData.servicePresent ? "stopped" : "absent",
    hostServiceNotice: statusData.servicePresent
      ? `Existing ManusPeripheralAgent service detected (${statusData.serviceRunning ? "running" : "stopped"}); host state was not modified.`
      : "",
  };
};
